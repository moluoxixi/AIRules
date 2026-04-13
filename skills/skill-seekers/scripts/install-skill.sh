#!/bin/bash
#===============================================================================
# 快速安装脚本 - 将技能安装到多个AI编程工具
#
# 用法:
#   ./install-skill.sh <skill-dir> [--target cursor|windsurf|cline|all]
#
# 示例:
#   ./install-skill.sh output/react-claude
#   ./install-skill.sh output/django-claude --target cursor
#   ./install-skill.sh output/fastapi-claude --target all
#===============================================================================

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 默认参数
SKILL_DIR=""
TARGET="cursor"

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --target)
            TARGET="$2"
            shift 2
            ;;
        *)
            SKILL_DIR="$1"
            shift
            ;;
    esac
done

# 检查参数
if [ -z "$SKILL_DIR" ]; then
    echo -e "${RED}错误: 请提供技能目录${NC}"
    echo "用法: $0 <skill-dir> [--target cursor|windsurf|cline|all]"
    exit 1
fi

if [ ! -d "$SKILL_DIR" ]; then
    echo -e "${RED}错误: 目录不存在: $SKILL_DIR${NC}"
    exit 1
fi

SKILL_NAME=$(basename "$SKILL_DIR" | sed 's/-claude$//')
SKILL_MD="$SKILL_DIR/SKILL.md"

if [ ! -f "$SKILL_MD" ]; then
    echo -e "${RED}错误: SKILL.md 不存在: $SKILL_MD${NC}"
    exit 1
fi

echo -e "${GREEN}安装技能: $SKILL_NAME${NC}"
echo "目标: $TARGET"
echo ""

install_cursor() {
    echo -e "${YELLOW}安装到 Cursor...${NC}"
    if [ -f ".cursorrules" ]; then
        echo "备份现有 .cursorrules -> .cursorrules.bak"
        cp .cursorrules .cursorrules.bak
    fi
    cp "$SKILL_MD" .cursorrules
    echo -e "${GREEN}✅ 已安装到 .cursorrules${NC}"
}

install_windsurf() {
    echo -e "${YELLOW}安装到 Windsurf...${NC}"
    mkdir -p .windsurf/rules
    cp "$SKILL_MD" ".windsurf/rules/$SKILL_NAME.md"
    echo -e "${GREEN}✅ 已安装到 .windsurf/rules/$SKILL_NAME.md${NC}"
}

install_cline() {
    echo -e "${YELLOW}安装到 Cline...${NC}"
    if [ -f ".clinerules" ]; then
        echo "备份现有 .clinerules -> .clinerules.bak"
        cp .clinerules .clinerules.bak
    fi
    cp "$SKILL_MD" .clinerules
    echo -e "${GREEN}✅ 已安装到 .clinerules${NC}"
}

# 执行安装
case $TARGET in
    cursor)
        install_cursor
        ;;
    windsurf)
        install_windsurf
        ;;
    cline)
        install_cline
        ;;
    all)
        install_cursor
        echo ""
        install_windsurf
        echo ""
        install_cline
        ;;
    *)
        echo -e "${RED}错误: 未知目标: $TARGET${NC}"
        echo "支持的选项: cursor, windsurf, cline, all"
        exit 1
        ;;
esac

echo ""
echo -e "${GREEN}✅ 安装完成!${NC}"
echo ""
echo "重启你的IDE使更改生效。"
