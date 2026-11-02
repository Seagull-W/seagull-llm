import torch
import torch.nn as nn
from cs336_basics.cha3.linear_and_embedding_module import Linear
from cs336_basics.cha3.RoPE import RotaryPositionalEmbedding
from cs336_basics.cha3.Scaled_Dot_Product_Attention import scaled_dot_product_attention


class CausalMultiHeadSelfAttention(nn.Module):
    """
    带 RoPE 的因果多头自注意力。
    """
    def __init__(self, d_model: int, num_heads: int, max_seq_len: int, theta: float, device=None, dtype=None, use_rope: bool = True):
        super().__init__()
        assert d_model % num_heads == 0, "d_model must be divisible by num_heads"
        
        self.d_model = d_model
        self.num_heads = num_heads
        self.d_k = d_model // num_heads  # 每个头的维度
        self.use_rope = use_rope
        
        # 1. Q, K, V 投影层（三个独立的 Linear）
        self.q_proj=Linear(d_model,d_model,device=device,dtype=dtype)
        self.k_proj=Linear(d_model,d_model,device=device,dtype=dtype)
        self.v_proj=Linear(d_model,d_model,device=device,dtype=dtype)
        # 2. 输出投影层
        self.out_project=Linear(d_model,d_model,device=device,dtype=dtype)
        
        # 3. RoPE 模块（仅在 use_rope=True 时初始化）
        self.rope = RotaryPositionalEmbedding(theta=theta, d_k=self.d_k, max_seq_len=max_seq_len, device=device) if use_rope else None


    def forward(self, x: torch.Tensor, token_positions: torch.Tensor | None = None) -> torch.Tensor:
        """
        前向传播
        参数:
            x: 输入张量，形状 (..., seq_len, d_model)
            token_positions: 可选的位置索引，形状 (..., seq_len)。若为 None 则使用 0,1,2,...,seq_len-1
        返回:
            输出张量，形状 (..., seq_len, d_model)
        """
        seq_len = x.size(-2)
        
        # 1. 如果 token_positions 为 None，创建默认的 0..seq_len-1  
        #这里默认x.size(0)是batch_size
        if token_positions is None:
            token_positions=torch.arange(0,seq_len,1, device=x.device).unsqueeze(0).expand(x.size(0),-1)
        
        # 2. 计算 Q, K, V 投影
        Q = self.q_proj(x)
        K = self.k_proj(x)
        V = self.v_proj(x)
        # 每个形状: (..., seq_len, d_model)
        
        # 3. 重塑为多头形式
        # 将 d_model 拆分为 (num_heads, d_k)
        #得到(num_heads,seq_length,d_k)
        Q=Q.view(*Q.shape[:-1],self.num_heads,self.d_k).transpose(-2,-3)
        K=K.view(*K.shape[:-1],self.num_heads,self.d_k).transpose(-2,-3)
        V=V.view(*V.shape[:-1],self.num_heads,self.d_k).transpose(-2,-3)
        # 4. 对 Q 和 K 应用 RoPE（如果启用）
        if self.use_rope:
            token_positions = token_positions.unsqueeze_(-2)
            Q = self.rope(Q, token_positions)
            K = self.rope(K, token_positions)
        # 5. 生成因果掩码
        '''
        torch.triu, when diagonal=1, 获取主对角线以上（不含）的部分
        '''
        mask=torch.triu(torch.ones(seq_len,seq_len,dtype=torch.bool,device=x.device),diagonal=1)
        mask=~mask
        # 6. 调用 scaled_dot_product_attention
        # 输出形状: (..., num_heads, seq_len, d_k)
        atten=scaled_dot_product_attention(Q,K,V,mask=mask)
        # 7. 合并多头
        # 提示: 先转置回 (..., seq_len, num_heads, d_k)，再重塑为 (..., seq_len, d_model)
        atten=atten.transpose(-3,-2).contiguous()
        atten=atten.view(*atten.shape[:-2],-1)
        
        # 8. 输出投影
        return self.out_project(atten)