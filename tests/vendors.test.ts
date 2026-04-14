import test from 'node:test';
import assert from 'node:assert';
import { VendorsConfig } from '../constants/skills.js';
// @ts-ignore
import { walkVendorTree } from '../scripts/lib/vendors.js';

test('walkVendorTree - Flat array structure', () => {
  const vendors: Record<string, any> = {};
  const mockConfig: VendorsConfig = [
    {
      name: 'vendor-a',
      official: true,
      source: 'https://github.com/a/a.git',
      skills: { 's1': 's1' }
    },
    {
      name: 'vendor-b',
      official: false,
      source: 'https://github.com/b/b.git',
      skills: { 's2': 's2' }
    }
  ];

  walkVendorTree(mockConfig, [], vendors);

  assert.ok(vendors['vendor-a'], 'vendor-a should be present');
  assert.ok(vendors['vendor-b'], 'vendor-b should be present');
  assert.strictEqual(vendors['vendor-a'].links[0].target, 'vendor/skills/s1');
  assert.strictEqual(vendors['vendor-b'].links[0].target, 'vendor/skills/s2');
});

test('walkVendorTree - Nested object inside array', () => {
  const vendors: Record<string, any> = {};
  const mockConfig: VendorsConfig = [
    {
      name: 'base-vendor',
      official: true,
      source: 'https://github.com/base.git',
      skills: { 'base': 'base' }
    },
    {
      "category-1": [
        {
          name: 'nested-vendor',
          official: true,
          source: 'https://github.com/nested.git',
          skills: { 'n1': 'n1' }
        }
      ]
    }
  ];

  walkVendorTree(mockConfig, [], vendors);

  assert.ok(vendors['base-vendor'], 'base-vendor should be at root');
  assert.ok(vendors['nested-vendor'], 'nested-vendor should be extracted');
  
  assert.strictEqual(vendors['base-vendor'].links[0].target, 'vendor/skills/base');
  // Should be nested in target path
  assert.strictEqual(vendors['nested-vendor'].links[0].target, 'vendor/skills/category-1/n1');
});

test('walkVendorTree - Deeply nested recursion', () => {
  const vendors: Record<string, any> = {};
  const mockConfig: any = [
    {
      "level-1": [
        {
          "level-2": [
            {
              name: 'deep-vendor',
              official: true,
              source: 'https://github.com/deep.git',
              skills: { 'deep': 'deep-skill' }
            }
          ]
        }
      ]
    }
  ];

  walkVendorTree(mockConfig, [], vendors);

  assert.ok(vendors['deep-vendor'], 'deeply nested vendor should be found');
  assert.strictEqual(
    vendors['deep-vendor'].links[0].target, 
    'vendor/skills/level-1/level-2/deep-skill'
  );
});

test('walkVendorTree - Invalid node error', () => {
  const vendors: Record<string, any> = {};
  const mockConfig: any = [
    "not-a-vendor-object"
  ];

  assert.throws(() => {
    walkVendorTree(mockConfig, [], vendors);
  }, /在分类 "根目录" 下发现无效的供应商节点定义/);
});
