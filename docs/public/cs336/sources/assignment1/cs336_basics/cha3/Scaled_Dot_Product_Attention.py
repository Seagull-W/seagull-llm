import torch
from cs336_basics.cha3.softmax import softmax


def scaled_dot_product_attention(
    Q: torch.Tensor,   # (..., queries, d_k)
    K: torch.Tensor,   # (..., keys, d_k)
    V: torch.Tensor,   # (..., keys, d_v)
    mask: torch.Tensor | None = None,  # (..., queries, keys), True=允许, False=屏蔽
) -> torch.Tensor:     # (..., queries, d_v)
    """
    缩放点积注意力机制。

    参数:
        Q: Query 张量，形状 (..., queries, d_k)
        K: Key 张量，形状 (..., keys, d_k)
        V: Value 张量，形状 (..., keys, d_v)
        mask: 可选的布尔掩码，形状 (..., queries, keys)。
              True 表示该位置允许参与注意力计算，
              False 表示该位置需要被屏蔽（设为 -inf）。

    返回:
        注意力输出张量，形状 (..., queries, d_v)
    """

    d_k=Q.size(-1)
    '''计算注意力分数: Q @ K^T'''
    score=torch.matmul(Q,K.transpose(-2,-1))
    '''缩放: 除以 sqrt(d_k)'''
    score=score/torch.sqrt(torch.tensor(d_k,dtype=Q.dtype,device=Q.device))
    '''
    mask处理，masked_fill_是原地操作，可以节省内存
    '''
    if mask is not None:
        score=score.masked_fill_(~mask,float('-inf'))
    '''计算 softmax（沿最后一维，即 keys 维度）'''
    attn_weights=softmax(score,dim=-1)

    return attn_weights@V