#!/usr/bin/env python3
"""
测试段落翻译功能
"""
import asyncio
import sys
from pathlib import Path

# 添加项目根目录到Python路径
project_root = Path(__file__).parent.parent
sys.path.insert(0, str(project_root))

from app.services.ai import GLMClient
from app.services.translation_engine import (
    SmartSegmenter,
    IncrementalTranslator
)


# 测试文本（包含HTML和代码块）
TEST_TEXT = """
<h1>深度学习简介</h1>

<p>深度学习（Deep Learning）是机器学习的一个分支，它基于人工神经网络进行学习。深度学习在图像识别、语音识别、自然语言处理等领域取得了突破性进展。</p>

<h2>核心概念</h2>

<p>神经网络由多个层组成，每一层都包含许多神经元。数据从输入层流向输出层，每一层都会对数据进行某种转换。</p>

<pre><code>
import torch
import torch.nn as nn

class SimpleNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.fc1 = nn.Linear(784, 128)
        self.fc2 = nn.Linear(128, 10)
    
    def forward(self, x):
        x = torch.relu(self.fc1(x))
        x = self.fc2(x)
        return x
</code></pre>

<p>上面的代码展示了一个简单的神经网络实现。这个网络有两层：第一层有784个输入和128个输出，第二层有128个输入和10个输出。</p>

<h2>训练过程</h2>

<p>训练神经网络需要大量的数据和计算资源。训练过程包括前向传播、计算损失、反向传播和参数更新。这个过程会重复进行多次，直到模型达到满意的性能。</p>

<p>现代深度学习框架如PyTorch和TensorFlow大大简化了这个过程。它们提供了自动微分、GPU加速等功能，使得研究人员可以更专注于模型设计而不是底层实现。</p>

<h2>应用领域</h2>

<ul>
<li>计算机视觉：图像分类、目标检测、图像分割</li>
<li>自然语言处理：机器翻译、文本生成、情感分析</li>
<li>语音识别：语音转文字、语音合成</li>
<li>推荐系统：个性化推荐、协同过滤</li>
</ul>

<p>深度学习已经成为人工智能领域最重要的技术之一，并且还在不断发展演进。</p>
"""


async def test_smart_segmenter():
    """测试智能分段器"""
    print("=" * 60)
    print("测试1: 智能段落分割")
    print("=" * 60)
    
    segments = SmartSegmenter.split_by_paragraphs(
        TEST_TEXT,
        max_length=500
    )
    
    print(f"\n✅ 分割结果: {len(segments)} 个段落\n")
    
    for seg in segments:
        is_code_mark = "📦 [代码块]" if seg['is_code'] else "📝 [文本]"
        content_preview = seg['content'][:80].replace('\n', ' ')
        print(f"{is_code_mark} 段落 {seg['index']}")
        print(f"   长度: {len(seg['content'])} 字符")
        print(f"   内容: {content_preview}...")
        print(f"   哈希: {seg['hash'][:8]}")
        print()


async def test_translation_with_mock():
    """使用模拟客户端测试翻译（不需要真实API）"""
    print("=" * 60)
    print("测试2: 模拟翻译流程（不调用真实API）")
    print("=" * 60)
    
    # 创建一个模拟的GLM客户端
    class MockGLMClient:
        async def translate(self, text, target_language='zh'):
            """模拟翻译 - 直接返回原文加标记"""
            await asyncio.sleep(0.1)  # 模拟网络延迟
            return f"[已翻译为{target_language}] {text[:50]}..."
    
    mock_client = MockGLMClient()
    translator = IncrementalTranslator(mock_client)
    
    # 进度回调
    def progress_callback(current, total, message):
        percent = int((current / total) * 100)
        bar_length = 40
        filled = int(bar_length * current / total)
        bar = '█' * filled + '░' * (bar_length - filled)
        print(f"\r进度: [{bar}] {percent}% - {message}", end='', flush=True)
    
    print("\n开始翻译...\n")
    
    result = await translator.translate_long_text(
        TEST_TEXT,
        target_language='zh',
        max_segment_length=500,
        max_concurrent=3,
        progress_callback=progress_callback
    )
    
    print("\n\n✅ 翻译完成!")
    print(f"\n原文长度: {len(TEST_TEXT)} 字符")
    print(f"译文长度: {len(result)} 字符")
    print(f"\n缓存统计: {translator.get_cache_stats()}")
    
    print("\n译文预览（前200字符）:")
    print("-" * 60)
    print(result[:200])
    print("-" * 60)


async def test_translation_real():
    """使用真实API测试翻译"""
    print("=" * 60)
    print("测试3: 真实API翻译（需要配置API密钥）")
    print("=" * 60)
    
    # 从环境变量读取API配置
    import os
    
    api_key = os.getenv('GLM_API_KEY')
    base_url = os.getenv('GLM_BASE_URL', 'https://open.bigmodel.cn/api/paas/v4')
    model = os.getenv('GLM_MODEL', 'glm-4-flash')
    
    if not api_key:
        print("\n⚠️  跳过真实API测试（未设置 GLM_API_KEY）")
        print("提示: 设置环境变量后重试:")
        print("  export GLM_API_KEY='your-api-key'")
        print("  export GLM_BASE_URL='https://open.bigmodel.cn/api/paas/v4'")
        print("  export GLM_MODEL='glm-4-flash'")
        return
    
    print(f"\n使用配置:")
    print(f"  Model: {model}")
    print(f"  Base URL: {base_url}")
    print(f"  API Key: {api_key[:10]}...")
    
    client = GLMClient(
        api_key=api_key,
        base_url=base_url,
        model=model
    )
    
    translator = IncrementalTranslator(client)
    
    # 使用较短的测试文本
    short_text = """
<h1>Introduction to Machine Learning</h1>

<p>Machine Learning is a subset of artificial intelligence that provides systems the ability to automatically learn and improve from experience without being explicitly programmed.</p>

<p>There are three main types of machine learning: supervised learning, unsupervised learning, and reinforcement learning.</p>
"""
    
    def progress_callback(current, total, message):
        percent = int((current / total) * 100)
        print(f"进度: {percent}% - {message}")
    
    print("\n开始翻译...\n")
    
    try:
        result = await translator.translate_long_text(
            short_text,
            target_language='zh',
            max_segment_length=300,
            max_concurrent=2,
            progress_callback=progress_callback
        )
        
        print("\n✅ 翻译成功!")
        print("\n译文:")
        print("=" * 60)
        print(result)
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ 翻译失败: {str(e)}")
        import traceback
        traceback.print_exc()


async def main():
    """运行所有测试"""
    print("\n🚀 段落翻译功能测试\n")
    
    # 测试1: 段落分割
    await test_smart_segmenter()
    
    # 测试2: 模拟翻译
    await test_translation_with_mock()
    
    # 测试3: 真实API（可选）
    print("\n")
    choice = input("是否测试真实API翻译？(y/N): ").lower()
    if choice == 'y':
        await test_translation_real()
    else:
        print("\n⏭️  跳过真实API测试")
    
    print("\n✅ 所有测试完成!\n")


if __name__ == "__main__":
    asyncio.run(main())







