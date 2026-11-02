import torch
import torch.nn as nn
import torch.nn.functional as F

from cs336_basics.cha3.linear_and_embedding_module import Linear

class SwiGLU(nn.Module):
    """
    SwiGLU 前馈网络
    公式: W2(SiLU(W1 * x)\elementwise dot (W3 * x))
    这里隐藏层的维数一般是d_model的倍数，本次输入固定值。实际上，原始transformer FFN有两个
    线性层，d*4d 4d*d，参数量为8d**2，现在的SwiGLU层有3ad**2（隐藏层维度为a*d）的参数，为使得
    参数量接近原有的，a=8/3,得到一个近似值
    """
    def __init__(self,d_model:int,d_ff:int,device=None,dtype=None):
        super().__init__()

        self.d_model=d_model
        #初始化线形层
        self.w1=Linear(d_model,d_ff)
        self.w2=Linear(d_ff,d_model)
        self.w3=Linear(d_model,d_ff)

    def forward(self,x:torch.Tensor)->torch.Tensor:
        """
        前向传播
        参数:
            x: 输入张量，形状为 (..., d_model)
        返回:
            输出张量，形状为 (..., d_model)
        """
        x_w1=self.w1.forward(x)
        x_w3=self.w3.forward(x)
        return self.w2.forward(F.silu(x_w1)*x_w3)
