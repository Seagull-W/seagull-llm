import torch

def softmax(x:torch.Tensor,dim:int=-1)->torch.Tensor:
    """
    数值稳定的 Softmax 函数。

    参数:
        x: 输入张量，形状任意
        dim: 沿哪个维度计算 softmax（默认为最后一维）

    返回:
        与 x 形状相同的张量，沿指定维度的值之和为 1
    """
    x_max=x.max(dim=dim,keepdim=True).values 
    '''
    tensor.max()返回values and indices
    保留维度，便于广播计算
    '''
    x_stable=x-x_max
    x_exp=torch.exp(x_stable)
    x_sum=x_exp.sum(dim=dim,keepdim=True)
    
    return x_exp/x_sum
