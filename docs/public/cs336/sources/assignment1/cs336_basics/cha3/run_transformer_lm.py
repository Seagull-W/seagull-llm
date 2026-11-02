import torch
import torch.nn as nn
from cs336_basics.cha3.transformer_block import TransformerBlock
from cs336_basics.cha3.linear_and_embedding_module import Linear ,embedding
from cs336_basics.cha3.RMSnorm import RMSNorm

class TransformerLM(nn.Module):
    def __init__(self, vocab_size: int, context_length: int, d_model: int, num_layers: int, num_heads: int, d_ff: int, rope_theta: float, device=None, dtype=None):
        super().__init__()
        '''
        - token Embedding → 将 token ID 映射为稠密向量
        - nn.ModuleList 容纳 num_layers 个 TransformerBlock
        - Final RMSNorm → 对所有层输出做最后一次归一化
        - LM Head (Linear) → 将 d_model 投影到 vocab_size ，输出每个 token 的 logits
        '''
        self.tok_emb=embedding(num_embeddings=vocab_size,embedding_dim=d_model,device=device,dtype=dtype)
        self.layers=nn.ModuleList([TransformerBlock(d_model=d_model,num_heads=num_heads,d_ff=d_ff,max_seq_length=context_length,theta=rope_theta,device=device,dtype=dtype) for _ in range(num_layers)])
        self.Final_RMS=RMSNorm(d_model=d_model,device=device,dtype=dtype)
        self.lm_head=Linear(d_model,vocab_size,device=device,dtype=dtype)
        #很多时候lm_head会和embedding共用参数

    def forward(self,token_ids:torch.Tensor)->torch.Tensor:
        """
        参数:
            token_ids: (batch_size, seq_len)
        返回:
            logits: (batch_size, seq_len, vocab_size)
        """
        x=self.tok_emb(token_ids)
        for layer in self.layers:
            x = layer(x)

        x=self.Final_RMS(x)
        return self.lm_head(x)
        

