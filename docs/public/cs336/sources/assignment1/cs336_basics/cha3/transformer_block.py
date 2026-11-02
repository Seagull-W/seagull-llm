import torch
import torch.nn as nn
from cs336_basics.cha3.RMSnorm import RMSNorm
from cs336_basics.cha3.Causal_Multi_Head_Self_Attention import CausalMultiHeadSelfAttention
from cs336_basics.cha3.SwiGLU import SwiGLU


class TransformerBlock(nn.Module):
    """
    Pre-Norm Transformer Block with RoPE.
    """
    def __init__(self,d_model:int,num_heads:int,d_ff:int,max_seq_length:int,theta:float,device=None,dtype=None):
        super().__init__()
        '''
        RMSNorm（MHA 前）>>多头自注意力>>第二个 RMSNorm（FFN 前）>>SwiGLU 前馈网络>>
        '''
        self.RMSNorm1=RMSNorm(d_model=d_model,device=device,dtype=dtype)
        self.MHA=CausalMultiHeadSelfAttention(d_model=d_model, num_heads=num_heads,max_seq_len=max_seq_length, theta=theta, device=device, dtype=dtype, use_rope= True)
        self.RMSNorm2=RMSNorm(d_model=d_model,device=device,dtype=dtype)
        self.SwiGLU=SwiGLU(d_model=d_model,d_ff=d_ff,device=device,dtype=dtype)


    def forward(self,x:torch.Tensor,token_positions:torch.Tensor |None=None)->torch.Tensor:
        '''
        (batch_size,seq_length,d_model)->BLOCK->(batch_size,seq_length,d_model)
        '''
        z=x+self.MHA(self.RMSNorm1(x), token_positions)
        output=z+self.SwiGLU(self.RMSNorm2(z))
        return output