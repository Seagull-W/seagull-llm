import json
import base64
from typing import Iterator,Any,Iterable


def apply_merge(token_bytes:list[bytes],merges:list[tuple[bytes,bytes]])->list[bytes]:
    while True:
        for merge in merges:
            (A,B)=merge
            for i in range(len(token_bytes)-1):
                if token_bytes[i]==A and token_bytes[i+1]==B:
                    token_bytes=token_bytes[:i]+[A+B]+token_bytes[i+2:]
                    break
            else:
                continue#此时for i in ...没有触发break，故试下一个merge，contibue跳过后续代码
            break#找到了，故跳出这个merge，重新扫描Merges
        else:
            break
    return token_bytes
        


class Tokenizer:
    def __init__(self,vocab:dict[int:bytes],merges:list[tuple[bytes,bytes]],special_tokens=None) -> Any:
        #vocab:dict[int,bytes]
        #merges:list[tuple[types,types]]
        #special_tokens:list[str]|none
        self.vocab=vocab
        self.merges=merges
        # 如果特殊 token 不在 vocab 中，自动追加
        if special_tokens:
            for spec in special_tokens:
                byte_encode=spec.encode("utf-8")
                if byte_encode not in self.vocab.values():
                    self.vocab[len(self.vocab)]=byte_encode
        self.special_tokens=special_tokens
        #vocab查
        self.bytes_to_token={b:t for t,b in vocab.items()}
        #merges要从后往前匹配
        self.merges_reverse={}
        for i in range(len(merges)):
            tu=merges[i]
            self.merges_reverse[tu]=i

        
        
            

    @classmethod
    def from_files(cls,vocab_path,merges_path,special_tokens=None):
        with open(vocab_path,'r',encoding='utf-8') as f:
            vocab_encoded=json.load(f)
        vocab={int(k):base64.b64decode(v) for k,v in vocab_encoded.items()}
        with open(merges_path,'r',encoding='utf-8') as f:
            merges=[]
            for line in f.readlines():
                b1_hex,b2_hex = line.strip().split()
                merges.append((bytes.fromhex(b1_hex),bytes.fromhex(b2_hex)))            

        return cls(vocab,merges,special_tokens)
            
    def encode(self,text:str)->list[int]:
        #编码器:文本-->token id 序列
        #降序排列特殊token
        import regex
        if self.special_tokens:
            special_token_reverse=sorted(self.special_tokens,key=len,reverse=True)
            delimiter='|'.join(map(regex.escape,special_token_reverse))
            chunks=regex.split(f'({delimiter})',text)#''里面有()就可以保留分隔符
        else:
            chunks=[text]
        final_ids=[]
        PAT = r"""'(?:[sdmt]|ll|ve|re)| ?\p{L}+| ?\p{N}+| ?[^\s\p{L}\p{N}]+|\s+(?!\S)|\s+"""
        for chunk in chunks:
            if self.special_tokens and (chunk in special_token_reverse):
                id=self.bytes_to_token[chunk.encode("utf-8")]
                final_ids.append(id)
            else:
                for word in regex.finditer(PAT,chunk):
                    word=word.group()
                    word_bytes=[bytes([b]) for b in word.encode("utf-8")]
                    chunk_token_bytes=apply_merge(word_bytes,merges=self.merges)
                    for b in chunk_token_bytes:
                        id=self.bytes_to_token[b]
                        final_ids.append(id)
                

        return final_ids
    

    def encode_iterable(self,iterable:Iterable[str])->Iterator[int]:
        #流式编码
        '''
        该函数完全依赖于外部的安全划分，即iterable的生成
        '''
        for file in iterable:
            yield from self.encode(file)
        '''
        此时self.encode(file)本身仍然会产生该列表的占用，在下一个file时内存释放（可利用）
        '''

    def decode(self,ids:list[int])->str:
        #ID列表-->文本
        result_bytes=b""
        for id in ids:
            result_bytes+=self.vocab[id]

        return result_bytes.decode("utf-8",errors="replace")