import copy


class Store:
    def __init__(self, records):
        self.records = copy.deepcopy(records)

    def read(self, record_id):
        return copy.deepcopy(self.records[record_id])

    def save(self, record, actor):
        if record["shop"] != actor["shop"] or record["owner"] != actor["id"]:
            raise PermissionError("本店原发起人才可操作")
        if record["state"] != "draft":
            raise ValueError("只有草稿可保存")
        for item in record["items"]:
            quantity = item["quantity"]
            if type(quantity) is not int or not 1 <= quantity <= 99:
                raise ValueError("数量必须为1到99的整数")
        return "保存成功"

    def submit(self, record_id, actor):
        record = self.read(record_id)
        self.save(record, actor)
        record["state"] = "submitted"
        self.records[record_id] = record
