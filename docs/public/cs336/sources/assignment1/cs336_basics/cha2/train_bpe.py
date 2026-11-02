from torch.utils import data
#from cs336_basics.pretokenization_example import find_chunk_boundaries
from typing import List, Tuple, Dict, Set
import os
import regex
import collections
import re
import json
import base64

def train_bpe(input_path:str|os.PathLike,vocab_size:int,special_tokens:list[str],**kwargs)->Tuple[Dict[int,bytes],List[Tuple[bytes,bytes]]]:
    """Given the path to an input corpus, run train a BPE tokenizer and
    output its vocabulary and merges.

    Args:
        input_path (str | os.PathLike): Path to BPE tokenizer training data.
        vocab_size (int): Total number of items in the tokenizer's vocabulary (including special tokens).
        special_tokens (list[str]): A list of string special tokens to be added to the tokenizer vocabulary.
            These strings will never be split into multiple tokens, and will always be
            kept as a single token. If these special tokens occur in the `input_path`,
            they are treated as any other string.

    Returns:
        tuple[dict[int, bytes], list[tuple[bytes, bytes]]]:
            vocab:
                The trained tokenizer vocabulary, a mapping from int (token ID in the vocabulary)
                to bytes (token bytes)
            merges:
                BPE merges. Each list item is a tuple of bytes (<token1>, <token2>),
                representing that <token1> was merged with <token2>.
                Merges are ordered by order of creation.
    """
    #输入检查
    if not isinstance(vocab_size,int) or vocab_size<=0:
        raise ValueError("vocab_size 必须是一个正整数")
    
    vocab:Dict[int,bytes]={i:bytes([i]) for i in range(256)}
    max_vocab_id=256 #新的token id 从256开始

    #defaultdict用于统计频率，它不用检查键是否存在
    pretoken_freq=collections.defaultdict(int)
    #o(1)查找
    exsiting_value=set(vocab.values())

    #将特殊字符存入vocab中
    for token in special_tokens:
        if len(vocab)>=vocab_size:
            break
        token=token.encode("utf-8")
        if token not in exsiting_value:
            vocab[max_vocab_id]=token
            exsiting_value.add(token)
            max_vocab_id+=1

    with open(input_path,'r',encoding='utf-8') as f:
        text=f.read()

    #特殊字符切分文本
    delimiter="|".join(re.escape(x) for x in special_tokens)
    chunks=re.split(delimiter,text)
    #预分词并计数
    PAT = r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| 
    ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
    for chunk in chunks:
        for word in regex.finditer(PAT,chunk):
            word=word.group()
            word_bytes=word.encode('utf-8')
            word_bytes_list=[bytes([x]) for x in word_bytes]
            pretoken_freq[tuple(word_bytes_list)]+=1
    #记录合并操作
    merge:list[tuple[bytes,bytes]]=[]

    #统计所有token对的频率（不含预分词的边界，如word iynv ，di不计算）
    pair_freq=collections.defaultdict(int)
    for key in pretoken_freq.keys():
        for i in range(len(key)-1):
            pair_freq[key[i],key[i+1]]+=pretoken_freq[key]


    #BPE主循环
    while max_vocab_id<vocab_size:
        if not pair_freq:
            break
        max_values=max(pair_freq.values())
        candi_list=list(filter(lambda x:pair_freq[x]==max_values,pair_freq.keys()))
        best_pair=max(candi_list)
        merge.append(best_pair)
        vocab[len(vocab)]=best_pair[0]+best_pair[1]
        max_vocab_id+=1
        #增量更新，核心代码
        #将预分词中这对相邻的词替换掉
        for seq,count in list(pretoken_freq.items()):
            new_seq=[]
            i=0
            while i<len(seq):
                if i<len(seq)-1 and seq[i]==best_pair[0] and seq[i+1]==best_pair[1]:
                    new_seq.append(best_pair[0]+best_pair[1])
                    i+=2
                else:
                    new_seq.append(seq[i])
                    i+=1
            #更新pair_seq，注意操作是在预分词的单元中进行的
            if len(new_seq)!=len(seq):
                for j in range(len(seq)-1):
                    pair_freq[seq[j],seq[j+1]]-=count
                for j in range(len(new_seq)-1):
                    pair_freq[new_seq[j],new_seq[j+1]]+=count
                
                pretoken_freq[tuple(new_seq)]=pretoken_freq.pop(seq)#替换
        #注意，这里pair_freq是可能出现0值的
        pair_freq=collections.defaultdict(int,{k:v for k,v in pair_freq.items() if v>0})
        
    return vocab,merge

def main():
    data_path='../../data/TinyStoriesV2-GPT4-valid.txt'
    special_tokens=['<|endoftext|>']
    vocab,merge=train_bpe(data_path,vocab_size=10000,special_tokens=special_tokens)
    #vocab储存：json, bytes -> base64 字符串
    vocab_encoded = {k: base64.b64encode(v).decode('ascii') for k, v in vocab.items()}
    with open('./encoder/vocab.json', 'w', encoding='utf-8') as f:
        json.dump(vocab_encoded, f, indent=2) 
    #merge储存
    with open('./encoder/merges.txt', 'w', encoding='utf-8') as f:
        for b1, b2 in merge:
            line = f"{b1.hex()} {b2.hex()}\n"
            f.write(line)
    print(merge[:10])

if __name__=='__main__':
    main()