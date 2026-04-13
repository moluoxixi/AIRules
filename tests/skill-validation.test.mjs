import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Directories to check for skills
const skillRoots = ['skills', 'vendor/skills'];

test('Agent Skills Validation', async (t) => {
  for (const root of skillRoots) {
    const fullRootPath = path.join(rootDir, root);
    
    if (!fs.existsSync(fullRootPath)) continue;

    const skills = fs.readdirSync(fullRootPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    if (skills.length === 0) continue;

    await t.test(`Checking root: ${root}`, async (st) => {
      for (const skillName of skills) {
        if (skillName.startsWith('.')) continue;

        await st.test(`Skill: ${skillName}`, () => {
          const skillPath = path.join(fullRootPath, skillName);
          
          // 1. SKILL.md naming (case insensitivity check)
          const files = fs.readdirSync(skillPath);
          const skillMdFile = files.find(f => f.toLowerCase() === 'skill.md');
          
          assert.ok(skillMdFile, `Missing SKILL.md in ${skillName}`);
          
          const content = fs.readFileSync(path.join(skillPath, skillMdFile), 'utf8');

          // 2. Validate Metadata (name and description)
          // Extract YAML frontmatter (between --- and ---)
          const yamlMatch = content.match(/^---\s*\n([\s\S]*?)\n---\s*\n/);
          assert.ok(yamlMatch, `SKILL.md in ${skillName} must start with YAML frontmatter (---)`);
          
          const yamlContent = yamlMatch[1];
          const nameMatch = yamlContent.match(/^name:\s*(.+)$/m);
          const descMatch = yamlContent.match(/^description:\s*(.+)$/m);
          
          assert.ok(nameMatch, `Missing 'name' in YAML frontmatter of ${skillName}`);
          assert.ok(descMatch, `Missing 'description' in YAML frontmatter of ${skillName}`);
          
          const nameValue = nameMatch[1].trim();
          const descValue = descMatch[1].trim();
          
          assert.ok(nameValue.length > 0, `'name' in ${skillName} cannot be empty`);
          assert.ok(descValue.length > 0, `'description' in ${skillName} cannot be empty`);

          // 3. Conditional Heading: references/
          const referencesPath = path.join(skillPath, 'references');
          if (fs.existsSync(referencesPath) && fs.statSync(referencesPath).isDirectory()) {
            // Must contain "参考文件", "参考资料" or "references" heading
            // Supporting both Chinese variants and English, case insensitive
            const headingRegex = /^#+\s+(参考文件|参考资料|references)/im;
            assert.ok(headingRegex.test(content), `Skill "${skillName}" contains a 'references/' directory but its SKILL.md is missing a "参考文件" or "references" heading.`);
          }

          // 4. Scripts directory (no specific heading required as per user instructions)
          // logic ends here for scripts
        });
      }
    });
  }
});
