LABELS = {"draft": "草稿", "submitted": "以提交", "cancelled": "已取消"}


def label(state):
    return LABELS.get(state, "未知状态")
