import { parseReferences } from '../src/lib/parseReferences'
import { verifyReference } from '../src/lib/verify'

const real = `［1］  袁大军，王飞，董朝文，等．盾构切削大直径钢筋混凝土桩基新型刀具研究［J］．中国公路学报，2016，29  ( 3) :
89－97．
Yuan Dajun，Wang  Fei ，Dong  Chaowen ，et  al．Study  on  new  style cutter  for shield cutting  large diameter reinforced concrete pile ［J］．China Journal of Highway and Transport，2016，29  (3) : 89－97．
［2］  梅君，崔伦萌，陈裕康，等．弧形撕裂刀切削钢筋混凝土桩基仿真与实践［J］．铁道标准设计，2025，69 ( 6) :
143－150，157．
Mei Jun，Cui Lunmeng ，Chen Yukang ，et al．Simulation and practice of curved ripper cutting reinforced concrete pile foundations ［J］．Railway Standard Design，2025，69(6) : 143－150，157．
［3］  李兴高，崔伦萌，方应冉���等．盾构切桩过程中刀盘荷载变化特征［J］．土木工程学报，2024，57  (增刊 1) : 59－64． Li Xinggao，Cui Lunmeng，Fang Yingran，et al．Research on cutterhead load variation characteristics during shield cutting pile process［J］．China Civil Engineering Journal，2024，57  (S1) : 59－64．
［4］  许华国，陈馈，孙振川．盾构刀盘切削钢筋混凝土桩基室内试验研究［J］．隧道建设 ( 中英文) ，2020，40  ( 1) : 35－42．
Xu  Huaguo ， Chen   Kui ， Sun  Zhenchuan． Laboratory  test  of  reinforced  concrete  pie  foundation  cutting  by  shield cutterhead ［J］．Tunnel Construction，2020，40( 1) : 35－42．

［5］   Shi Peixin ，Tao  Yufan ，Jia Pengjiao ，et  al．Experimental  study on  shield  machine  cutting  steel-reinforced  concrete diaphragm wall ［J］．Tunnelling and Underground Space Technology，2024，153 : DOI : 10. 1016 /j．tust．2024．106008．
［6］  朱宏宇，刘维，史培新，等．盾构切削钢筋混凝土地连墙的破坏模式及机理研究［J］．河北工程大学学报( 自然科学版) ，2025，42(4) : 1－8，48．
Zhu Hongyu，Liu Wei，Shi Peixin，et al．Analysis of damage modes and mechanisms of shield cutting reinforced concrete diaphragm walls［J］．Journal of Hebei University of Engineering  (Natural  Science Edition) ，2025，42(4) : 1－8，48．
［7］  乔世范，张睿，王广，等．砾砂地层盾构切削大直径群桩的刀具研究［J］．铁道科学与工程学报，2024，21 (5) :
1 966－1 978．
Qiao Shifan，Zhang Rui，Wang Guang，et al．Shield cutter for cutting large diameter group piles in gravel stratum［J］． Journal of Railway Science and Engineering，2024，21  (5) :  1 966－1 978．
［8］  欧阳剑，段锴，曾庆成，等．盾构滚刀－切刀组合切削桩基相互作用机理及关键参数分析研究［J］．土木工程学��， 2024，57  (增刊 1) : 102－108．
Ouyang Jian，Duan Kai，Zeng Qingcheng，et al．Study on interaction mechanism and key parameters of shield hob-scraper combination cutting pile foundation ［J］．China Civil Engineering Journal，2024，57  (S1) :  102－108．
［9］   Guan Xiaoming，Liu Zeliang，Xu Huawei，et  al．Mechanical  properties and influencing factors of shield cutting existing station supporting piles［J］．Sustainability，2023，15 : DOI : 10.  3390 / su151511699．
［10］ 陈一凡，黄书华，沈翔，等．密集城区超大直径盾构切削群桩对上部建筑物振动影响规律分析［J］．现代隧道技术，2024，61  (3) : 266－275．
Chen Yifan，Huang Shuhua，Shen Xiang，et al．Analysis on the vibration influence on upper buildings induced by cutting of pile group by  extra-large-diameter  shield  in dense urban areas［J］．Moder Tunnelling Technology ，2024，61  ( 3) : 266－275．
［11］ 李海波，张昕阳，孙天赦，等．泥岩地层盾构切削桩基沉降规律及加固技术［J］．铁道建筑，2025，65  (2) : 95－100． Li Haibo，Zhang  Xinyang ，Sun Tianshe ，et  al．Settlement  law  of  shield  tunneling  cutting  pile  in  mudstone  strata  and reinforcement technologies for pile foundations ［J］．Railway Engineering，2025，65  (2) : 95－100．
［12］ 张建设，黄艳龙，李瑚均，等．基于改进 N－K 模型的地铁盾构掘进安全风险耦合研究［J］．中国安全科学学报， 2024，34  (2) : 67－75．
Zhang Jianshe，Huang  Yanlong ，Li  Hujun ，et  al．Study  on  coupling  of  subway shield  tunneling safety risk based on improved N－K model ［J］．China Safety Science Journal，2024，34  (2) : 67－75．
［13］ 吴贤国，冯宗宝，刘俊，等．基于 RF-NSGA- Ⅱ 的盾构施工地表沉降安全控制多目标优化［J］．中国安全科学学报， 2022，32  (8) : 45－51．
Wu Xianguo，Feng Zongbao，Liu Jun，et al．Multi-objective optimization of surface settlement safety control during shield construction based on RF-NSGA-II ［J］．China Safety Science Journal，2022，32(8) : 45－51．
［14］ 王飞．盾构直接掘削大直径钢筋混凝土群桩研究［D］．北京: 北京交通大学，2014．
Wang  Fei．Study  on  shield  cutting  large  diameter  reinforced  concrete  piles  directly［D］．Beijing : Beijing   Jiaotong University，2014．
［15］ GB 50010—2010 混凝土结构设计规范［S］．
GB 50010－2010    Code for design of concrete  structures［S］．
［16］  Malvar L J，Crawford J E．Dynamic increase factors for steel reinforcing bars   [R] .  DDESB Seminar，1998．`

const refs = parseReferences(real)
console.log(`=== 切分出 ${refs.length} 条 ===\n`)
for (const r of refs) {
  console.log(`${r.id} [${r.lang}] year=${r.year ?? '-'} doi=${r.doi ?? '-'}`)
  console.log(`   中文题名: ${r.title ?? '-'}`)
  console.log(`   英文译名: ${r.altTitle ?? '-'}`)
}

console.log('\n=== 核实 ===')
for (const r of refs) {
  const res = await verifyReference(r)
  console.log(
    `${r.id} ${res.status} score=${res.score?.toFixed(2) ?? '-'} :: ${res.match?.title ?? res.message ?? ''}`,
  )
}
