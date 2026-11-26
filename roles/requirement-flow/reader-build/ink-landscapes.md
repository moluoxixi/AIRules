# 阅读器水墨山水素材

2026-11-26 使用内置 `image_gen` 生成新的日景，再以日景为编辑目标生成同构图夜景。两图的左侧保留文字留白，山水集中右侧；装饰资源不承载业务内容。经系统 `sips` 仅作 JPEG 编码以减少网页传输量，不裁切或改构图，运行时无需图像工具。

- 项目素材：`skills/requirement-flow/reader/assets/ink-landscape-light.jpg`、`ink-landscape-dark.jpg`。
- 日景原图：`~/.codex/generated_images/01a21658-093f-7e82-a184-c6476e875611/exec-2efe5797-af28-44ca-b393-8dfe803a4b34.png`。
- 夜景原图：同目录 `exec-6d56bc66-d4eb-459f-9ffd-85fc5940d874.png`。
- 先前临时取出的旧版图片未被采用，已清理。

## 日景生成提示

```text
Use case: stylized-concept.
Asset type: a finished decorative background painting for the narrow header of a Chinese business documentation reader, not a UI mockup.
Primary request: Create an original Chinese ink-wash landscape, refined, quiet and contemporary, with the atmosphere and brushwork of a Song dynasty landscape handscroll.
Composition: extra-wide panoramic 3:1 horizontal canvas. The LEFT TWO THIRDS are generous clean warm ivory rice-paper negative space, almost empty. A restrained mountain composition sits ONLY in the RIGHT THIRD: layered distant misty ridges, one gently rising foreground mountain and a few spare pine silhouettes, fading naturally into the paper toward the center. Keep the scene low and horizontally composed so it can be cropped into a shallow website masthead. The top edge is calm and pale.
Palette: warm ivory paper close to #fcf7ea, dilute charcoal ink, muted grey-jade and very subtle mineral green, no saturated color. Authentic soft ink bleeding and delicate rice-paper grain, no heavy yellow or brown aging. Painterly, not vector, not photographic.
Constraints: no text, no calligraphy, no seals, no logos, no UI, no border, no people, no decorative symbols. Keep the entire left 65% extremely quiet for overlaid text. Opaque background, high quality production illustration.
```

## 夜景编辑提示

```text
Use case: lighting-weather.
Edit target: the supplied newly generated ink-wash header painting.
Create its matching NIGHT-THEME companion. Preserve the exact panoramic canvas, composition, mountain contours, pine silhouettes, brushwork and the generous empty LEFT TWO THIRDS. Change only the palette and atmosphere.
Replace the warm ivory paper with a quiet deep charcoal-jade paper close to #151c1c, with a subtle natural matte fiber texture. Render distant mountains with very dilute cool jade-grey mist, nearer ridges and pine with slightly lighter desaturated grey-green ink so the scene remains visible on a dark website masthead. Aim for a calm moonlit atmosphere without drawing any moon, stars, lanterns or extra objects. Keep the top and left calm and almost uniform, suitable for light overlaid UI text. The scene is still only in the right third, fading into the dark paper. Preserve all existing geometry; no added mountains or trees. No text, calligraphy, seal, logo, border, UI or watermark. Opaque background.
```
