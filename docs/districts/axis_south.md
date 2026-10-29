# 分区 axis_south 数据清单

范围 x∈[-128,128] z∈[-118,580]（x 东，z 南，北 = -z）。坐标为世界米制坐标。
尺寸 sx×sz 为 OSM 屋檐外轮廓（轴对齐外接矩形，sx 沿东西、sz 沿南北）。rect=面积/外接矩形面积（<0.86 自动分解为多个矩形翼）。
自动推断列：类型/屋顶/等级/朝向/面阔×进深@(中心)。

## 建筑（68）

| OSM id | 名称 | 中心 x,z | sx×sz | rect | 分类 | OSM 标签 | 自动推断 |
|---|---|---|---|---|---|---|---|
| 40605845 | 广播室 | 98.1, -62.1 | 16.2×6.8 | 0.944 | hall | height=5 roof:shape=gabled roof:colour=#FB994D building=yes | hall/yingshan/g5/朝南/16.2×6.8@(98.1,-62.1) |
| 40605846 | 九卿房 | 87.4, -108.9 | 39.1×8.3 | 0.976 | hall | building=yes | hall/yingshan/g4/朝南/39.1×8.3@(87.4,-108.9) |
| 40605848 | 军机处 | -88.2, -108.4 | 36.7×8.6 | 0.977 | hall | roof:colour=#FB994D building=yes | hall/yingshan/g4/朝南/36.7×8.6@(-88.2,-108.4) |
| 40605849 |  | -99.3, -60.7 | 14.6×6.8 | 0.951 | hall | height=5 roof:shape=gabled roof:colour=#FB994D building=yes | hall/yingshan/g5/朝北/14.6×6.8@(-99.3,-60.7) |
| 42509106 | 内右门 | -65.0, -113.7 | 5.5×2.3 | 0.959 | gate | height=8 roof:shape=gabled roof:colour=#FB994D building=gatehouse historic=city_gate | gate/yingshan/g5/朝南/5.5×2.3@(-65.0,-113.7) |
| 42623315 | 内左门 | 62.6, -114.2 | 5.5×2.6 | 0.961 | gate | height=8 roof:shape=gabled roof:colour=#FB994D building=gatehouse historic=city_gate | gate/yingshan/g5/朝南/5.5×2.6@(62.6,-114.2) |
| 228767332 | 公共厕所 | -58.0, -117.4 | 4.1×5.0 | 0.912 | hall | height=5 roof:shape=hipped roof:colour=#FB994D building=yes building:levels=1 | hall/xieshan/g5/朝西/5.0×4.1@(-58.0,-117.4) |
| 478109300 |  | 124.0, -21.9 | 13.2×40.5 | 0.811 | hall | building=yes | hall/yingshan/g4/朝东/40.4×8.9@(125.9,-22.0); hall/yingshan/g5/朝东/18.5×4.0@(119.5,-11.0) |
| 523763697 |  | 113.6, -56.5 | 4.4×20.5 | 0.952 | hall | building=yes building:levels=1 | hall/yingshan/g5/朝东/20.5×4.4@(113.6,-56.5) |
| 638156236 |  | 23.7, 489.6 | 11.6×5.8 | 0.976 | hall | height=5 roof:shape=gabled roof:colour=#FB994D building=yes | hall/yingshan/g5/朝南/11.6×5.8@(23.7,489.6) |
| 638156248 |  | -26.2, 490.1 | 11.9×5.3 | 0.971 | hall | height=5 roof:shape=gabled roof:colour=#FB994D building=yes | hall/yingshan/g5/朝南/11.9×5.3@(-26.2,490.1) |
| 638156366 | 午门 | 1.1, 511.0 | 190.3×108.2 | 0.39 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝南/132.5×26.9@(-4.2,470.9); gate/xieshan/g3/朝东/80.5×23.9@(50.1,524.6); gate/xieshan/g3/朝西/80.5×20.8@(-52.5,524.6); gate/xieshan/g3/朝南/34.1×13.9@(79.1,474.2); gate/xieshan/g4/朝南/23.6×14.1@(-82.3,477.3); gate/xuanshan/g5/朝西/9.8×6.5@(65.3,462.4) |
| 638218765 | 熙和门 | -110.3, 392.9 | 56.8×36.6 | 0.748 | gate | building=yes historic=city_gate | gate/xieshan/g3/朝南/56.4×20.6@(-110.3,392.6); gate/xieshan/g4/朝南/37.7×8.1@(-100.9,406.9); gate/xieshan/g4/朝南/20.6×7.6@(-109.5,378.5) |
| 638218767 | 院墙3 | -105.4, 345.8 | 22.8×57.8 | 0.635 | hall | building=yes | hall/yingshan/g3/朝西/57.7×13.6@(-109.7,345.8); hall/yingshan/g5/朝南/8.8×5.9@(-98.5,341.6) |
| 638218799 | 院墙1 | -106.2, 441.4 | 23.0×60.9 | 0.65 | hall | building=yes | hall/yingshan/g3/朝东/52.3×14.7@(-110.0,437.1); hall/yingshan/g5/朝南/11.0×8.5@(-111.9,467.5); hall/yingshan/g5/朝南/8.0×5.3@(-98.7,442.2) |
| 638238294 | 协和门 | 105.5, 391.0 | 56.8×36.4 | 0.765 | gate | building=yes historic=city_gate | gate/xieshan/g3/朝南/56.3×20.7@(105.6,390.4); gate/xieshan/g4/朝南/21.5×8.3@(106.8,404.9); gate/xieshan/g4/朝南/21.5×7.2@(106.8,376.5); gate/xieshan/g5/朝南/18.7×2.4@(86.7,378.9) |
| 638238303 | 院墙2 | 100.5, 439.5 | 21.8×60.9 | 0.595 | hall | building=yes | hall/yingshan/g3/朝西/55.3×11.4@(104.5,436.8); hall/yingshan/g5/朝南/9.1×7.6@(94.3,440.1); hall/yingshan/g5/朝北/9.0×5.5@(105.8,467.2) |
| 638238311 | 院墙4 | 101.0, 344.3 | 23.3×57.2 | 0.598 | hall | building=yes | hall/yingshan/g3/朝东/57.0×13.2@(105.7,344.3); hall/yingshan/g5/朝南/9.6×5.3@(94.3,340.3) |
| 638308745 | 太和门 | -2.4, 305.1 | 71.7×53.3 | 0.527 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝南/56.2×29.7@(-1.5,305.9); gate/xieshan/g5/朝东/12.6×6.3@(-2.4,284.7); gate/xieshan/g5/朝东/10.9×6.3@(-2.4,326.2); gate/xieshan/g5/朝东/11.4×3.4@(-9.1,285.4); gate/xieshan/g5/朝西/11.4×3.4@(5.1,285.4); gate/xieshan/g5/朝东/10.9×3.4@(-9.1,326.2); gate/xieshan/g5/朝西/10.9×3.4@(5.1,326.2); gate/xieshan/g5/朝南/8.7×2.9@(-33.9,317.6); gate/xieshan/g5/朝南/6.8×3.0@(30.0,316.5) |
| 638320784 | city_gate | 61.8, 315.4 | 23.4×2.1 | 0.944 | hall | building=yes | hall/yingshan/g5/朝南/23.4×2.1@(61.8,315.4) |
| 638320792 | 昭德门 | 62.0, 305.5 | 26.7×55.7 | 0.636 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝西/55.6×11.3@(61.5,305.5); gate/xieshan/g4/朝西/17.7×8.1@(71.2,305.5); gate/xieshan/g5/朝东/17.7×7.1@(52.3,305.5); gate/xieshan/g5/朝南/6.5×2.0@(70.4,295.7); gate/xieshan/g5/朝南/6.5×2.0@(70.4,315.4); gate/xieshan/g5/朝南/5.6×2.0@(53.0,295.7); gate/xieshan/g5/朝南/5.6×2.0@(53.0,315.4) |
| 638320793 | 贞度门 | -64.6, 305.0 | 26.8×55.7 | 0.636 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝东/55.7×11.3@(-65.1,305.0); gate/xieshan/g4/朝西/21.7×6.5@(-56.2,305.0); gate/xieshan/g5/朝东/17.4×7.1@(-74.3,304.9); gate/xieshan/g5/朝南/5.6×2.3@(-73.6,314.7); gate/xieshan/g5/朝南/5.6×2.0@(-73.6,295.2) |
| 638329249 | 侧墙3 | 37.7, 306.6 | 22.2×13.7 | 0.989 | hall | building=yes | hall/yingshan/g4/朝南/22.2×13.7@(37.7,306.6) |
| 638329250 | 侧墙2 | -40.5, 306.4 | 22.0×13.7 | 0.98 | hall | building=yes | hall/yingshan/g4/朝南/22.0×13.7@(-40.5,306.4) |
| 638344003 | 侧墙4 | 86.7, 305.6 | 23.1×13.8 | 0.981 | hall | building=yes | hall/yingshan/g4/朝南/23.1×13.8@(86.7,305.6) |
| 638344012 | 侧墙1 | -87.8, 306.0 | 20.1×13.7 | 0.98 | hall | building=yes | hall/yingshan/g4/朝南/20.1×13.7@(-87.8,306.0) |
| 638344315 | 崇楼2 | 107.7, 304.7 | 19.2×19.0 | 0.98 | hall | building=yes | hall/xieshan/g4/朝南/19.2×19.0@(107.7,304.7) |
| 638344324 | 崇楼1 | -107.3, 306.3 | 19.2×19.0 | 0.979 | hall | building=yes | hall/xieshan/g4/朝南/19.2×19.0@(-107.3,306.3) |
| 638449259 |  | 48.4, 102.3 | 30.3×2.3 | 0.917 | hall | building=yes | hall/yingshan/g5/朝南/30.3×2.3@(48.4,102.3) |
| 638449270 |  | -50.1, 102.3 | 33.0×1.9 | 0.886 | hall | building=yes | hall/yingshan/g5/朝南/33.0×1.9@(-50.1,102.3) |
| 638449347 | 太和殿 | -0.0, 90.5 | 67.4×40.1 | 0.983 | hall | building=palace historic=palace | hall/wudian/g2/朝南/67.4×40.1@(-0.0,90.5) |
| 638449433 |  | -1.8, 142.3 | 133.5×78.5 | 0.637 | platform | building=yes | 石台 |
| 638460864 |  | 45.2, -31.9 | 36.0×3.0 | 0.921 | hall | building=yes | hall/yingshan/g5/朝南/36.0×3.0@(45.2,-31.9) |
| 638460865 |  | -45.6, -31.4 | 40.5×2.8 | 0.914 | hall | building=yes | hall/yingshan/g5/朝南/40.5×2.8@(-45.6,-31.4) |
| 638467894 |  | -1.1, -56.9 | 132.4×48.7 | 0.549 | platform | building=yes | 石台 |
| 638473398 | 保和殿 | 0.9, -33.0 | 52.9×27.7 | 0.985 | hall | building=palace historic=palace | hall/wudian/g2/朝南/52.9×27.7@(0.9,-33.0) |
| 638507491 | 侧墙8 | 94.1, -32.3 | 8.9×12.2 | 0.975 | hall | building=yes | hall/yingshan/g5/朝西/12.2×8.9@(94.1,-32.3) |
| 638507502 | 侧墙7 | -96.0, -32.0 | 7.2×13.8 | 0.973 | hall | building=yes | hall/yingshan/g5/朝东/13.8×7.2@(-96.0,-32.0) |
| 638507610 | 崇楼4 | 107.9, -32.7 | 19.2×19.0 | 0.979 | hall | building=yes | hall/xieshan/g4/朝北/19.2×19.0@(107.9,-32.7) |
| 638507657 | 崇楼3 | -109.0, -31.7 | 19.2×19.0 | 0.979 | hall | building=yes | hall/xieshan/g4/朝北/19.2×19.0@(-109.0,-31.7) |
| 638507747 | 后左门 | 76.4, -33.5 | 26.8×55.7 | 0.635 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝东/55.6×11.3@(76.0,-33.5); gate/xieshan/g4/朝西/17.7×8.1@(85.7,-33.5); gate/xieshan/g5/朝东/17.7×7.1@(66.7,-33.5); gate/xieshan/g5/朝南/6.5×2.0@(84.9,-43.3); gate/xieshan/g5/朝南/6.5×2.0@(84.9,-23.6); gate/xieshan/g5/朝南/5.5×2.0@(67.6,-43.3); gate/xieshan/g5/朝南/5.5×2.0@(67.6,-23.6) |
| 638507769 | 后右门 | -79.2, -32.3 | 26.8×55.7 | 0.635 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝西/55.6×11.3@(-79.7,-32.3); gate/xieshan/g4/朝西/17.7×8.1@(-69.9,-32.3); gate/xieshan/g5/朝东/17.7×7.1@(-88.9,-32.3); gate/xieshan/g5/朝南/6.5×2.0@(-70.7,-22.5); gate/xieshan/g5/朝南/6.5×2.0@(-70.7,-42.2); gate/xieshan/g5/朝南/5.6×2.0@(-88.1,-22.5); gate/xieshan/g5/朝南/5.6×2.0@(-88.1,-42.2) |
| 638507783 | 中左门 | 76.8, 102.7 | 26.8×55.7 | 0.635 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝东/55.6×11.3@(76.3,102.7); gate/xieshan/g4/朝西/17.7×8.0@(86.0,102.7); gate/xieshan/g5/朝东/17.7×7.1@(67.1,102.7); gate/xieshan/g5/朝南/6.5×2.0@(85.2,92.8); gate/xieshan/g5/朝南/6.5×2.0@(85.2,112.5); gate/xieshan/g5/朝南/5.6×2.0@(67.9,92.8); gate/xieshan/g5/朝南/5.6×2.0@(67.9,112.5) |
| 638507841 | 中右门 | -79.9, 102.6 | 26.8×55.7 | 0.636 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝西/55.6×11.3@(-80.4,102.6); gate/xieshan/g4/朝西/17.7×8.1@(-70.7,102.6); gate/xieshan/g5/朝东/17.7×7.1@(-89.6,102.6); gate/xieshan/g5/朝南/6.5×2.0@(-71.5,92.8); gate/xieshan/g5/朝南/6.5×2.0@(-71.5,112.5); gate/xieshan/g5/朝南/5.6×2.0@(-88.8,92.8); gate/xieshan/g5/朝南/5.6×2.0@(-88.8,112.5) |
| 638513244 | 院墙6 | 101.8, 53.3 | 26.6×148.4 | 0.652 | hall | building=yes | hall/yingshan/g2/朝东/148.4×16.4@(106.6,53.3); hall/yingshan/g5/朝南/9.9×3.8@(93.5,38.2); hall/yingshan/g5/朝南/8.2×3.9@(94.3,79.4); hall/yingshan/g5/朝南/8.2×3.5@(94.3,57.3); hall/yingshan/g5/朝南/8.2×3.2@(94.3,20.0); hall/yingshan/g5/朝南/8.2×3.0@(94.3,2.0) |
| 638513245 | 院墙7 | -107.3, 53.5 | 27.4×147.9 | 0.735 | hall | building=yes | hall/yingshan/g2/朝西/147.8×18.4@(-109.9,53.5); hall/yingshan/g5/朝东/70.0×1.8@(-120.0,92.4); hall/yingshan/g5/朝南/7.1×4.3@(-97.2,39.5); hall/yingshan/g5/朝南/5.6×3.2@(-97.9,80.0); hall/yingshan/g5/朝南/5.6×3.2@(-97.9,2.4); hall/yingshan/g5/朝南/5.6×3.1@(-97.9,59.0); hall/yingshan/g5/朝南/5.6×3.0@(-97.9,20.6) |
| 638517041 | 侧墙6 | 94.1, 102.9 | 8.4×12.0 | 0.975 | hall | building=yes | hall/yingshan/g5/朝西/12.0×8.4@(94.1,102.9) |
| 638517042 | 侧墙5 | -97.2, 103.5 | 8.1×12.2 | 0.975 | hall | building=yes | hall/yingshan/g5/朝东/12.2×8.1@(-97.2,103.5) |
| 638590074 | 院墙8 | 103.0, 263.2 | 26.2×64.1 | 0.707 | hall | building=yes | hall/xieshan/g3/朝东/64.1×15.9@(106.3,263.2); hall/xieshan/g5/朝西/56.9×1.8@(115.2,261.5); hall/xieshan/g5/朝南/8.4×5.9@(94.2,249.0); hall/xieshan/g5/朝南/8.4×5.0@(94.2,272.6) |
| 638590075 | 院墙5 | -106.6, 264.9 | 21.9×64.0 | 0.744 | hall | building=yes | hall/xieshan/g3/朝西/62.1×15.0@(-109.1,265.8); hall/xieshan/g5/朝南/5.6×5.5@(-98.7,274.3); hall/xieshan/g5/朝南/5.6×5.3@(-98.7,250.8); hall/xieshan/g5/朝南/13.6×1.8@(-108.4,233.8) |
| 638590122 | 体仁阁 | 99.6, 199.8 | 43.0×62.9 | 0.695 | tower | building=yes | hall/xieshan/g2/朝西/62.8×28.4@(106.8,199.8); hall/xieshan/g5/朝南/14.5×6.6@(85.3,199.5) |
| 638590123 | 弘义阁 | -103.7, 201.5 | 38.1×62.9 | 0.735 | tower | building=yes | hall/xieshan/g2/朝东/62.8×27.0@(-109.1,201.5); hall/xieshan/g5/朝南/11.0×6.2@(-90.1,200.9) |
| 638590133 |  | 106.7, 163.7 | 16.8×9.4 | 0.992 | hall | building=yes | hall/yingshan/g4/朝南/16.8×9.4@(106.7,163.7) |
| 638590140 | 左翼门 | 107.3, 143.3 | 44.4×31.6 | 0.732 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝南/44.3×15.7@(107.2,142.7); gate/xieshan/g4/朝北/20.9×8.4@(108.7,154.8); gate/xieshan/g4/朝南/20.9×7.4@(108.7,131.2) |
| 638590146 |  | -109.8, 165.2 | 16.1×9.9 | 0.981 | hall | building=yes | hall/yingshan/g4/朝南/16.1×9.9@(-109.8,165.2) |
| 638590169 | 右翼门 | -111.8, 143.8 | 42.4×33.0 | 0.711 | gate | building=gatehouse historic=city_gate | gate/xieshan/g3/朝南/42.2×15.4@(-111.7,143.7); gate/xieshan/g4/朝北/19.7×8.8@(-111.5,155.9); gate/xieshan/g4/朝南/19.7×8.6@(-111.5,131.7) |
| 638807748 | 景运门 | 105.8, -84.6 | 26.7×32.3 | 0.859 | gate | building=yes historic=city_gate | gate/xieshan/g3/朝西/32.0×18.7@(106.8,-84.6); gate/xieshan/g5/朝西/18.8×4.7@(95.1,-85.9); gate/xieshan/g5/朝西/18.8×2.9@(117.5,-85.9) |
| 638807749 | 隆宗门 | -110.1, -83.1 | 26.7×32.3 | 0.859 | gate | building=yes historic=city_gate | gate/xieshan/g3/朝东/32.0×18.7@(-109.2,-83.1); gate/xieshan/g5/朝东/18.8×4.7@(-120.9,-84.3); gate/xieshan/g5/朝东/18.8×2.9@(-98.4,-84.3) |
| 638807768 | 井 | -91.2, -54.7 | 5.3×5.0 | 0.934 | well | height=4 roof:shape=pyramidal roof:colour=#FB994D building=roof | pavilion/luding/g5/朝南/5.3×5.0@(-91.2,-54.7) |
| 638807769 | 井 | 89.6, -56.0 | 5.3×5.0 | 0.936 | well | height=4 roof:shape=pyramidal roof:colour=#FB994D building=roof | pavilion/luding/g5/朝南/5.3×5.0@(89.6,-56.0) |
| 638959718 |  | -39.0, -117.1 | 7.7×4.1 | 0.957 | hall | height=5 roof:shape=hipped roof:colour=#FB994D building=yes building:levels=1 | hall/xieshan/g5/朝南/7.7×4.1@(-39.0,-117.1) |
| 638959719 |  | -49.3, -117.3 | 8.2×3.9 | 0.95 | hall | height=5 roof:shape=hipped roof:colour=#FB994D building=yes building:levels=1 | hall/xieshan/g5/朝南/8.2×3.9@(-49.3,-117.3) |
| 642560665 |  | 124.3, 20.9 | 14.2×35.5 | 0.94 | hall | building=yes | hall/yingshan/g4/朝东/35.5×14.2@(124.3,20.9) |
| 685292441 |  | -30.4, 513.7 | 23.3×5.1 | 0.958 | hall | height=5 roof:shape=gabled roof:colour=#FB994D building=yes | hall/yingshan/g5/朝南/23.3×5.1@(-30.4,513.7) |
| 685292442 |  | 27.1, 514.2 | 22.2×5.7 | 0.963 | hall | height=5 roof:shape=gabled roof:colour=#FB994D building=yes | hall/yingshan/g5/朝南/22.2×5.7@(27.1,514.2) |
| 687866541 |  | 119.7, -106.8 | 20.3×10.0 | 0.537 | hall | building=yes | hall/yingshan/g5/朝南/20.1×4.2@(119.8,-109.5); hall/yingshan/g5/朝东/5.6×4.2@(111.8,-104.6) |
| 8854306 |  | -1.4, 35.4 | 134.1×132.3 | 0.743 | hall | building=yes | hall/xieshan/g3/朝西/90.0×67.7@(0.4,25.6); hall/xieshan/g3/朝西/54.2×32.9@(-49.9,74.2); hall/xieshan/g3/朝东/54.2×30.1@(49.3,74.2); hall/xieshan/g3/朝东/48.3×32.9@(-49.9,-6.2); hall/xieshan/g3/朝西/48.3×30.1@(49.3,-6.2); hall/yingshan/g5/朝西/29.2×4.1@(-35.5,32.5); hall/yingshan/g5/朝西/11.0×8.0@(-29.4,-24.8); hall/yingshan/g5/朝南/12.1×6.6@(-43.6,31.7); hall/yingshan/g5/朝东/11.0×7.1@(30.7,-24.8); hall/yingshan/g5/朝东/41.1×1.6@(-67.2,-2.6); hall/yingshan/g5/朝南/9.5×6.6@(39.0,31.7); hall/yingshan/g5/朝东/23.2×1.6@(-67.2,82.2) |
| 8854349 | 中和殿 | 0.5, 25.9 | 26.7×26.5 | 0.984 | hall | building=palace historic=palace | hall/cuanjian/g3/朝南/26.7×26.5@(0.5,25.9) |

## 墙（10）

| id | 名称 | 类型 | 高 | 点数 | 前几点 |
|---|---|---|---|---|---|
| 638176319 |  | city_wall | 4 | 35 | (-375,489) (-347,489) (-94,484) (-87,484) … |
| 638807563 |  | wall | 2 | 3 | (-107,-52) (-94,-51) (-94,-57) |
| 638807567 |  | wall | 2 | 3 | (93,-59) (93,-53) (107,-53) |
| 638807612 |  | building_wall(多边形) |  | 15 | (19,-119) (20,-119) (17,-119) (17,-120) … |
| 638807626 |  | building_wall(多边形) | 8 | 10 | (65,-113) (68,-113) (77,-113) (107,-113) … |
| 638807713 |  | building_wall(多边形) | 8 | 9 | (-68,-113) (-70,-113) (-78,-113) (-107,-113) … |
| 638807738 |  | building_wall(多边形) | 7 | 5 | (109,-101) (109,-113) (107,-113) (107,-105) … |
| 638807739 |  | building_wall(多边形) | 7 | 5 | (107,-69) (107,-53) (107,-42) (109,-42) … |
| 638807744 |  | building_wall(多边形) | 7 | 5 | (-110,-99) (-109,-113) (-107,-113) (-107,-104) … |
| 638807747 |  | building_wall(多边形) | 7 | 5 | (-110,-67) (-111,-41) (-107,-41) (-107,-52) … |
