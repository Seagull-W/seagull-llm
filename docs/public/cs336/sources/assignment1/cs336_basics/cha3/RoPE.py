import torch
import torch.nn as nn

class RotaryPositionalEmbedding(nn.Module):
    """
    旋转位置编码 (RoPE)
    """
    def __init__(self,theta:float,d_k:int,max_seq_len:int,device=None):
        '''
        theta是基础旋转角度的常量，RoPE中theta_i=10000**(-2*(i-1)/d)
        d_k是词嵌入维度
        '''
        super().__init__()
        self.d_k=d_k
        assert d_k%2==0
        #创建一个从 0 到 d_k/2 - 1 的张量 k
        k=torch.arange(0,d_k/2,1)
        freq=theta**(-2*k/d_k)
        #位置为m的token的嵌入每次旋转m*freq
        i=torch.arange(0,max_seq_len,1)
        '''
        广播, 得到(max_seqlength, d_k/2),
        每一行是对应token嵌入的d_k/2对二维分量的旋转角度
        '''
        angles=i.unsqueeze(1)*freq.unsqueeze(0)
        sinTensor=torch.sin(angles)
        cosTensor=torch.cos(angles)
        '''
        注册到buffer中，且存在state_dict中
        '''
        self.register_buffer("sin",sinTensor,persistent=True)
        self.register_buffer("cos",cosTensor,persistent=True)

    def forward(self,x:torch.Tensor,token_positions:torch.Tensor)->torch.Tensor:
        """
        前向传播
        参数:
            x: 输入张量，形状为 (..., seq_len, d_k)
            token_positions: Token 的位置索引，形状为 (..., seq_len), \
                注意这里的token_positions以及Init里的position表都只取决于Token在输入序列中的相对位置，
                和token-word映射表没有必然联系
        返回:
            应用 RoPE 后的张量，形状与 x 相同
        """
        
        sin_tensor=self.sin[token_positions]
        cos_tensor=self.cos[token_positions]
        '''
        (...,seq_length,d_k/2)--
        将 x 的最后一个维度重塑为 (d_k / 2, 2), 确保x连续（用view操作）
        '''
        x_reshaped=x.contiguous().view(*x.shape[:-1],-1,2)
        x1=x_reshaped[...,0]
        x2=x_reshaped[...,1]

        rotated_x1 = x1 *  cos_tensor- x2 * sin_tensor
        rotated_x2 = x2 *  cos_tensor+ x1 * sin_tensor
        #stack操作不要求连续，且输出是连续的
        return torch.stack([rotated_x1,rotated_x2],-1).view_as(x)
