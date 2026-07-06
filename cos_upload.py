#!/usr/bin/env python3
"""
腾讯云 COS 文件上传工具
用法: python cos_upload.py <文件路径>

配置方式（任选其一，优先级从高到低）:
  1. 环境变量: COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION
  2. 脚本同目录下的 .cos_config 文件（INI 格式）
"""

import os
import sys
import time
import argparse
import configparser
import mimetypes
from pathlib import Path

# ──────────────────────────────────────────────
# 依赖检查
# ──────────────────────────────────────────────
def _require(pkg, install_name=None):
    try:
        return __import__(pkg)
    except ImportError:
        install_name = install_name or pkg
        print(f"[错误] 缺少依赖包 '{install_name}'，请先安装:")
        print(f"       pip install {install_name}")
        sys.exit(1)

_require("qcloud_cos", "cos-python-sdk-v5")
_require("tqdm")

from qcloud_cos import CosConfig, CosS3Client
from qcloud_cos.cos_exception import CosServiceError, CosClientError
from tqdm import tqdm

# ──────────────────────────────────────────────
# 配置加载
# ──────────────────────────────────────────────
CONFIG_FILE = Path(__file__).parent / ".cos_config"
CONFIG_TEMPLATE = """\
[cos]
secret_id  = YOUR_SECRET_ID
secret_key = YOUR_SECRET_KEY
bucket     = your-bucket-name-1234567890
region     = ap-guangzhou
"""

def load_config() -> dict:
    cfg = {}

    # 先尝试读取配置文件
    if CONFIG_FILE.exists():
        parser = configparser.ConfigParser()
        parser.read(CONFIG_FILE, encoding="utf-8")
        if "cos" in parser:
            sec = parser["cos"]
            cfg = {
                "secret_id":  sec.get("secret_id", "").strip(),
                "secret_key": sec.get("secret_key", "").strip(),
                "bucket":     sec.get("bucket", "").strip(),
                "region":     sec.get("region", "").strip(),
            }

    # 环境变量优先覆盖
    env_map = {
        "secret_id":  "COS_SECRET_ID",
        "secret_key": "COS_SECRET_KEY",
        "bucket":     "COS_BUCKET",
        "region":     "COS_REGION",
    }
    for key, env_key in env_map.items():
        val = os.environ.get(env_key, "").strip()
        if val:
            cfg[key] = val

    # 校验必填项
    missing = [k for k in ("secret_id", "secret_key", "bucket", "region") if not cfg.get(k)]
    if missing:
        print("[错误] 缺少以下配置项:", ", ".join(missing))
        print()
        print("请选择以下任一方式配置：")
        print(f"  ① 创建配置文件 {CONFIG_FILE}，内容如下:")
        print("─" * 48)
        print(CONFIG_TEMPLATE)
        print("─" * 48)
        print("  ② 设置环境变量:")
        print("     COS_SECRET_ID / COS_SECRET_KEY / COS_BUCKET / COS_REGION")
        sys.exit(1)

    return cfg

# ──────────────────────────────────────────────
# 带进度条的上传回调
# ──────────────────────────────────────────────
class ProgressCallback:
    """包装 tqdm，适配 COS SDK 的 progress_callback(consumed, total)"""

    def __init__(self, total: int, filename: str):
        self._bar = tqdm(
            total=total,
            unit="B",
            unit_scale=True,
            unit_divisor=1024,
            desc=f"上传 {filename}",
            ncols=80,
            colour="cyan",
            dynamic_ncols=True,
        )
        self._last = 0

    def __call__(self, consumed: int, total: int):
        delta = consumed - self._last
        if delta > 0:
            self._bar.update(delta)
            self._last = consumed

    def close(self):
        self._bar.close()

# ──────────────────────────────────────────────
# 上传逻辑
# ──────────────────────────────────────────────
MULTIPART_THRESHOLD = 10 * 1024 * 1024   # 10 MB 以上用分块上传

def upload_file(local_path: str, cfg: dict) -> str:
    file_path = Path(local_path).resolve()
    if not file_path.exists():
        print(f"[错误] 文件不存在: {file_path}")
        sys.exit(1)
    if not file_path.is_file():
        print(f"[错误] 路径不是文件: {file_path}")
        sys.exit(1)

    file_size = file_path.stat().st_size
    object_key = file_path.name          # 上传到桶根目录，文件名不变
    content_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"

    cos_cfg = CosConfig(
        Region=cfg["region"],
        SecretId=cfg["secret_id"],
        SecretKey=cfg["secret_key"],
    )
    client = CosS3Client(cos_cfg)

    progress = ProgressCallback(file_size, file_path.name)
    start_ts = time.time()

    try:
        with open(file_path, "rb") as fp:
            if file_size >= MULTIPART_THRESHOLD:
                # 分块上传（自动多线程）
                client.upload_file(
                    Bucket=cfg["bucket"],
                    LocalFilePath=str(file_path),
                    Key=object_key,
                    ContentType=content_type,
                    PartSize=8,          # 每块 8 MB
                    MAXThread=4,
                    progress_callback=progress,
                )
            else:
                # 简单上传
                client.put_object(
                    Bucket=cfg["bucket"],
                    Body=fp,
                    Key=object_key,
                    ContentType=content_type,
                    ContentLength=str(file_size),
                )
                # 简单上传 SDK 不回调进度，手动填满进度条
                progress(file_size, file_size)

    except (CosServiceError, CosClientError) as e:
        progress.close()
        print(f"\n[错误] 上传失败: {e}")
        sys.exit(1)
    finally:
        progress.close()

    elapsed = time.time() - start_ts
    speed = file_size / elapsed / 1024 / 1024 if elapsed > 0 else 0

    region = cfg["region"]
    bucket = cfg["bucket"]
    url = f"https://{bucket}.cos.{region}.myqcloud.com/{object_key}"

    print()
    print("✓ 上传成功!")
    print(f"  大小  : {_human_size(file_size)}")
    print(f"  耗时  : {elapsed:.1f}s  ({speed:.1f} MB/s)")
    print(f"  Key   : {object_key}")
    print(f"  URL   : {url}")
    return url

# ──────────────────────────────────────────────
# 工具函数
# ──────────────────────────────────────────────
def _human_size(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if n < 1024:
            return f"{n:.1f} {unit}"
        n /= 1024
    return f"{n:.1f} PB"

# ──────────────────────────────────────────────
# 入口
# ──────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(
        description="上传文件到腾讯云 COS 并返回公开 URL",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument("file", help="要上传的本地文件路径")
    args = parser.parse_args()

    cfg = load_config()
    upload_file(args.file, cfg)


if __name__ == "__main__":
    main()
