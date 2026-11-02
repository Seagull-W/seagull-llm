import torch
import torch.nn as nn

class RMSNorm(nn.Module):
    """
    Root Mean Square Layer Normalization (RMSNorm)
    """
    def __init__(self, d_model: int, eps: float = 1e-5, device=None, dtype=None):
        super().__init__()
        self.eps = eps
        self.d_model = d_model
        
        # 1. 创建可学习的增益参数 g_i (通常命名为 weight)
        # 提示: 形状为 (d_model,), 在逐元素相乘时自动广播
        # 根据文档，初始化为全 1 (torch.ones)
        self.weight=nn.Parameter(torch.ones(d_model, device=device, dtype=dtype))

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        """
        前向传播
        参数:
            x: 输入张量，形状为 (batch_size, sequence_length, d_model) 或 (..., d_model)
        返回:
            归一化后的张量，形状与输入相同
        """
        # 2. 记录原始数据类型
        in_dtype = x.dtype
        
        # 3. 将输入转换为 float32 以防止溢出
        x_f32 = x.to(torch.float32)
        
        # 4. 计算 RMS (均方根)
        x_square=x_f32**2
        x_mean=x_square.mean(dim=-1,keepdim=True)
        rms=torch.sqrt(x_mean+self.eps)
        # 5. 归一化输入
        x_normed=x_f32/rms
        # 6. 转换回原始数据类型，并乘以可学习的增益参数 self.weight 逐元素相乘并自动广播
        return x_normed.to(in_dtype)*self.weight