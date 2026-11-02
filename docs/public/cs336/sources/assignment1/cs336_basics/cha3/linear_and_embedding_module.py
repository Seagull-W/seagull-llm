import torch
import torch.nn as nn
import math

class Linear(nn.Module):
    def __init__(self,in_features:int,out_features:int,device=None,dtype=None):
        super().__init__()
        '''nn.module的基本方法，如state dict(param, modules, buffers), param tracking,
        device/dtype casting, save and load model(by .stat_dict()), bool type(training/evaluation)
        '''
        #权重矩阵的shape [in_dim,out_dim]
        #初始化参数，要求截断正态分布
        self.in_features=in_features
        self.out_features=out_features
        #nn.Parameter与普通tensor的区别在：自动求导为true，加入modle的state_dict，用来储存可学习参数
        self.weight=nn.Parameter(torch.empty(in_features,out_features,device=device,dtype=dtype))
        '''
        在源码中注意到：
        "mean is more than 2 std from [a, b] in nn.init.trunc_normal_. "
        "The distribution of values may be incorrect."
        '''
        std=math.sqrt(2/(in_features+out_features))
        nn.init.trunc_normal_(self.weight,mean=0,std=std,a=-3*std,b=3*std)

    def forward(self,x:torch.Tensor) -> torch.Tensor:
        """
        前向传播: y=x \dot W
        参数:
            x: 输入张量，形状通常为 (..., in_features)，其中 ... 表示任意数量的批次维度
        返回:
            输出张量，形状为 (..., out_features)
        """
        assert x.size(-1)==self.weight.size(0)
        return torch.matmul(x,self.weight)
    

class embedding(nn.Module):
    """
    自定义的词嵌入层。
    将整数 Token ID 映射为稠密向量。
    Token ID(0,1,...)与行相对应, 意味着id为i的token的嵌入向量在第i行
    """
    def __init__(self,num_embeddings:int,embedding_dim:int,device=None,dtype=None):
        super().__init__()

        self.num_embeddings=num_embeddings
        self.embedding_dim=embedding_dim
        self.weight=nn.Parameter(torch.empty(self.num_embeddings,self.embedding_dim,device=device,dtype=dtype))
        #初始化，均值 mu=0, 方差 sigma^2 = 1 (即标准差 sigma=1)截断范围为 [-3, 3]
        nn.init.trunc_normal_(self.weight,mean=0,std=1,a=-3,b=3)

    def forward(self,token_ids:torch.Tensor)->torch.Tensor:
        """
        前向传播(嵌入查找)
        参数:
            token_ids: 包含整数 ID 的张量，形状通常为 (batch_size, sequence_length)
        返回:
            嵌入向量张量，形状为 (batch_size, sequence_length, embedding_dim)

        在查找过程中，梯度汇聚是nn自带的，以下是nn.embedding有，但是本作业没有实现的
        归一化（范数超过阈值时,先归一再查找，但是容易导致训练震荡，因为这种硬约束可能会妨碍优化器），
        另外还有稀疏更新和冻结参数
        """
        return self.weight[token_ids]


