import unittest
from inventory import Store


class SaveTest(unittest.TestCase):
    def test_save_message(self):
        record = {"id": "a", "shop": "s1", "owner": "u1", "state": "draft",
                  "items": [{"sku": "apple", "quantity": 2}]}
        store = Store({"a": record})
        actor = {"shop": "s1", "id": "u1"}
        record["items"][0]["quantity"] = 3
        self.assertEqual(store.save(record, actor), "保存成功")
