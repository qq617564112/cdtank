# 正式宠物模型预览

M6-04-PREVIEW 在我的家与商城原 `picModel` 区域加载宠物定义对应的 `Data/Pet/%.3d/n1.glb`。定义ID、默认n1动作、原MV3及嵌入11005纹理来自 pet-model-preview-source.md；拥有实例ID不参与资源路径。

`assets/pets/pet-view.ts` 拥有模型容器、原材质替换与动作采样。材质加入容器的释放范围，候选替换时释放旧模型和纹理，保留页面场景。采样使用现有actor时钟的4800单位/秒及GLB毫秒轨道。n1循环展示是Web重建规则：原GotoAction参数0已定位，但循环语义尚未恢复。

`interface/resources/pet-model-preview.tsx` 拥有独立Engine、Scene、Camera、渲染循环和ResizeObserver。React按宠物定义替换模型；购买状态和目录刷新不重建场景。关闭或切离分类释放全部场景资源，迟到模型加载被丢弃并释放。画布在缩放提交后按源区域实际尺寸设置像素。

Home按已定位MyPet调用每帧旋转0.0075；商城保持静止。初始镜头、包围盒取景、照明与缩放为重建展示规则，未声明原Windows逐像素一致。原完整宠物动作、技能、成长与页面精度仍由对应未完成父项约束。
