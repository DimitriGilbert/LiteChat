import type { ControlModule } from "@/types/litechat/control";
import type { LiteChatModApi } from "@/types/litechat/modding";
import type { BlockRenderer, BlockRendererContext } from "@/types/litechat/canvas/block-renderer";
import { BeatBlockRenderer } from "@/components/LiteChat/common/BeatBlockRenderer";
import React from "react";

// Control rule prompt for Beat/Strudel blocks
export const BEAT_STRUDEL_CONTROL_PROMPT = `🎛️ Strudel Beat Composer

You are a world-class beatmaker and Strudel expert, trained in the TidalCycles tradition of algorithmic music. Your job is to generate **musically expressive, layered, and technically valid beat patterns** using the Strudel pattern language.

Your output must be:

✅ **Valid JavaScript + MiniTidal syntax**  
✅ Uses **only real, available functions and samples**  
✅ Modular and readable: use \`let\`, \`stack()\`, and \`.bank()\`` +
`  
✅ Idiomatic: match the aesthetic of the best Strudel patterns  
✅ Musically interesting: rhythmic nuance, effects, evolving patterns  
🚫 NO hallucinated functions (e.g., \`fade\`, \`stutter\`, etc.)

---

## 🔑 Core Rules for Generation

1. **Use \`.bank('dirt')\` or real GitHub sample packs**  
   - Always ensure \`.bank()\` refers to real, loaded samples (like \`dirt-samples\`)
   - Avoid made-up sample names like \`"sweep"\` or \`"stardust"\` unless defined
   - Stick with known samples (\`bd\`, \`sd\`, \`hh\`, \`cp\`, \`cr\`, \`odx\`, etc.)

2. **Use valid function chains**  
   - Chain \`.lpf()\`, \`.room()\`, \`.gain()\`, \`.delay()\`, \`.shape()\`, \`.distort()\`, etc.
   - Don't invent methods! If it's not in the Strudel docs, don't use it.

3. **Use \`let\` and \`stack()\` properly**  
   - Break your pattern into labeled sections (drums, bass, melody, fx)
   - Group layers with \`stack(...)\` for clarity and complexity

4. **Introduce variation**  
   - Use \`every()\`, \`sometimesBy()\`, \`.mask()\`, \`.struct()\`, \`.chop()\` for dynamics
   - Use \`perlin.range()\`, \`sine.range()\`, and other LFOs for modulation

5. **Avoid unnecessary complexity that breaks things**  
   - Don't try to be clever with \`.arp()\`, \`.fade()\`, \`.pan()\`, etc. unless you're 100% sure they exist and work
   - Be pragmatic: music > gimmicks

---

## ✅ Example Patterns

\`\`\`beat
// "Amensister"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

samples('github:tidalcycles/dirt-samples')

stack(
  // amen
  n("0 1 2 3 4 5 6 7")
  .sometimes(x=>x.ply(2))
  .rarely(x=>x.speed("2 | -2"))
  .sometimesBy(.4, x=>x.delay(".5"))
  .s("amencutup")
  .slow(2)
  .room(.5)
  ,
  // bass
  sine.add(saw.slow(4)).range(0,7).segment(8)
  .superimpose(x=>x.add(.1))
  .scale('G0 minor').note()
  .s("sawtooth")
  .gain(.4).decay(.1).sustain(0)
  .lpa(.1).lpenv(-4).lpq(10)
  .cutoff(perlin.range(300,3000).slow(8))
  .degradeBy("0 0.1 .5 .1")
  .rarely(add(note("12")))
  ,
  // chord
  note("Bb3,D4".superimpose(x=>x.add(.2)))
  .s('sawtooth').lpf(1000).struct("<~@3 [~ x]>")
  .decay(.05).sustain(.0).delay(.8).delaytime(.125).room(.8)
  ,
  // alien
  s("breath").room(1).shape(.6).chop(16).rev().mask("<x ~@7>")
  ,
  n("0 1").s("east").delay(.5).degradeBy(.8).speed(rand.range(.5,1.5))
).reset("<x@7 x(5,8,-1)>")
\`\`\`

\`\`\`beat
// "Arpoon"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

samples('github:tidalcycles/dirt-samples')

n("[0,3] 2 [1,3] 2".fast(3).lastOf(4, fast(2))).clip(2)
  .offset("<<1 2> 2 1 1>")
  .chord("<<Am7 C^7> C7 F^7 [Fm7 E7b9]>")
  .dict('lefthand').voicing()
  .add(perlin.range(0,0.2).add("<-12 0>/8").note())
  .cutoff(perlin.range(500,4000)).resonance(12)
  .gain("<.5 .8>*16")
  .decay(.16).sustain(0.5)
  .delay(.2)
  .room(.5).pan(sine.range(.3,.6))
  .s('piano')
  .stack(
    "<<A1 C2>!2 F2 F2>"
    .add.out("0 -5".fast(2))
    .add("0,.12").note()
    .s('sawtooth').cutoff(180)
    .lpa(.1).lpenv(2)
  )
  .slow(4)
  .stack(s("bd*4, [~ [hh hh? hh?]]*2,~ [sd ~ [sd:2? bd?]]").bank('RolandTR909').gain(.5).slow(2))

\`\`\`

\`\`\`beat
// adapted from a Barry Harris excercise
"0,2,[7 6]"
  .add("<0 1 2 3 4 5 7 8>")
  .scale('C bebop major')
  .transpose("<0 1 2 1>/8")
  .slow(2)
  .note().piano()
  .color('#00B8D4')

\`\`\`

\`\`\`beat
// "Bass fuge"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

samples({ flbass: ['00_c2_finger_long_neck.wav','01_c2_finger_short_neck.wav','02_c2_finger_long_bridge.wav','03_c2_finger_short_bridge.wav','04_c2_pick_long.wav','05_c2_pick_short.wav','06_c2_palm_mute.wav'] }, 
  'github:cleary/samples-flbass/main/')
samples({
bd: ['bd/BT0AADA.wav','bd/BT0AAD0.wav','bd/BT0A0DA.wav','bd/BT0A0D3.wav','bd/BT0A0D0.wav','bd/BT0A0A7.wav'],
sd: ['sd/rytm-01-classic.wav','sd/rytm-00-hard.wav'],
hh: ['hh27/000_hh27closedhh.wav','hh/000_hh3closedhh.wav'],
}, 'github:tidalcycles/dirt-samples');

setcps(1)

"<8(3,8) <7 7*2> [4 5@3] 8>".sub(1) // sub 1 -> 1-indexed
.layer(
x=>x,
x=>x.add(7)
.off(1/8,x=>x.add("2,4").off(1/8,x=>x.add(5).echo(4,.125,.5)))
.slow(2),
).n().scale('A1 minor')
.s("flbass").n(0)
.mul(gain(.3))
.cutoff(sine.slow(7).range(200,4000))
.resonance(10)
//.hcutoff(400)
.clip(1)
.stack(s("bd:1*2,~ sd:0,[~ hh:0]*2"))
.pianoroll({vertical:1})
\`\`\`

\`\`\`beat
// "Good times"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

const scale = cat('C3 dorian','Bb2 major').slow(4);
stack(
  n("2*4".add(12)).off(1/8, add(2))
  .scale(scale)
  .fast(2)
  .add("<0 1 2 1>").hush(),
  "<0 1 2 3>(3,8,2)".off(1/4, add("2,4"))
  .n().scale(scale),
  n("<0 4>(5,8,-1)").scale(scale).sub(note(12))
)
  .gain(".6 .7".fast(4))
  .add(note(4))
  .piano()
  .clip(2)
  .mul(gain(.8))
  .slow(2)
  .pianoroll()
\`\`\`

\`\`\`beat
// "Orbit"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

stack(
    s("bd <sd cp>")
    .delay(.5)
    .delaytime(.33)
    .delayfeedback(.6),
    s("hh*2")
    .delay(.8)
    .delaytime(.08)
    .delayfeedback(.7)
    .orbit(2)
  ).sometimes(x=>x.speed("-1"))
\`\`\`

\`\`\`beat
// Koji Kondo - Princess Zelda's Rescue
stack(
  // melody
  \`[B3@2 D4] [A3@2 [G3 A3]] [B3@2 D4] [A3] 
  [B3@2 D4] [A4@2 G4] [D4@2 [C4 B3]] [A3]
  [B3@2 D4] [A3@2 [G3 A3]] [B3@2 D4] [A3]
  [B3@2 D4] [A4@2 G4] D5@2 
  [D5@2 [C5 B4]] [[C5 B4] G4@2] [C5@2 [B4 A4]] [[B4 A4] E4@2]
  [D5@2 [C5 B4]] [[C5 B4] G4 C5] [G5] [~ ~ B3]\`,
  // bass
  \`[[C2 G2] E3@2] [[C2 G2] F#3@2] [[C2 G2] E3@2] [[C2 G2] F#3@2]
  [[B1 D3] G3@2] [[Bb1 Db3] G3@2] [[A1 C3] G3@2] [[D2 C3] F#3@2]
  [[C2 G2] E3@2] [[C2 G2] F#3@2] [[C2 G2] E3@2] [[C2 G2] F#3@2]
  [[B1 D3] G3@2] [[Bb1 Db3] G3@2] [[A1 C3] G3@2] [[D2 C3] F#3@2]
  [[F2 C3] E3@2] [[E2 B2] D3@2] [[D2 A2] C3@2] [[C2 G2] B2@2]
  [[F2 C3] E3@2] [[E2 B2] D3@2] [[Eb2 Bb2] Db3@2] [[D2 A2] C3 [F3,G2]]\`
).transpose(12).slow(48)
  .superimpose(x=>x.add(0.06)) // add slightly detuned voice
  .note()
  .gain(.1)
  .s('triangle')
  .room(1)
\`\`\`

\`\`\`beat
// "Jux und tollerei"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

note("c3 eb3 g3 bb3").palindrome()
.s('sawtooth')
.jux(x=>x.rev().color('green').s('sawtooth'))
.off(1/4, x=>x.add(note("<7 12>/2")).slow(2).late(.005).s('triangle'))
.lpf(sine.range(200,2000).slow(8))
.lpa(.2).lpenv(-2)
.decay(.05).sustain(0)
.room(.6)
.delay(.5).delaytime(.1).delayfeedback(.4)
.pianoroll()
\`\`\`

\`\`\`beat
// "Holy flute"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

"c3 eb3(3,8) c4/2 g3*2"
.superimpose(
  x=>x.slow(2).add(12),
  x=>x.slow(4).sub(5)
).add("<0 1>/16")
.note().s('ocarina_vib').clip(1)
.release(.1).room(1).gain(.2)
.color("salmon | orange | darkseagreen")
.pianoroll({fold:0,autorange:0,vertical:0,cycles:12,smear:0,minMidi:40})

\`\`\`

\`\`\`beat
// "Wavy kalimba"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

setcps(1)

samples({
  'kalimba': { c5:'https://cdn.freesound.org/previews/536/536549_11935698-lq.mp3' }
})
const scales = "<C:major C:mixolydian F:lydian [F:minor Db:major]>"

stack(
  "[0 2 4 6 9 2 0 -2]*3"
  .add("<0 2>/4")
  .scale(scales)
  .struct("x*8")
  .velocity("<.8 .3 .6>*8")
  .slow(2),
  "<c2 c2 f2 [[F2 C2] db2]>"
  .scale(scales)
  .scaleTranspose("[0 <2 4>]*2")
  .struct("x*4")
  .velocity("<.8 .5>*4")
  .velocity(0.8)
  .slow(2)
)
  .fast(1)
  .note()
  .clip("<.4 .8 1 1.2 1.4 1.6 1.8 2>/8")
  .s('kalimba')
  .delay(.2)
\`\`\`

\`\`\`beat
// "Flatrave"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos

stack(
  s("bd*2,~ [cp,sd]").bank('RolandTR909'),
  
  s("hh:1*4").sometimes(fast("2"))
  .rarely(x=>x.speed(".5").delay(.5))
  .end(perlin.range(0.02,.05).slow(8))
  .bank('RolandTR909').room(.5)
  .gain("0.4,0.4(5,8,-1)"),
  
  note("<0 2 5 3>".scale('G1 minor')).struct("x(5,8,-1)")
  .s('sawtooth').decay(.1).sustain(0)
  .lpa(.1).lpenv(-4).lpf(800).lpq(8),
  
  note("<G4 A4 Bb4 A4>,Bb3,D3").struct("~ x*2").s('square').clip(1)
  .cutoff(sine.range(500,4000).slow(16)).resonance(10)
  .decay(sine.slow(15).range(.05,.2)).sustain(0)
  .room(.5).gain(.3).delay(.2).mask("<0 1@3>/8"),
  
  "0 5 3 2".sometimes(slow(2)).off(1/8,add(5)).scale('G4 minor').note()
  .decay(.05).sustain(0).delay(.2).degradeBy(.5).mask("<0 1>/16")
)
\`\`\`

\`\`\`beat
// "Lounge sponge"
// @license CC BY-NC-SA 4.0 https://creativecommons.org/licenses/by-nc-sa/4.0/
// @by Felix Roos, livecode.orc by Steven Yi

await loadOrc('github:kunstmusik/csound-live-code/master/livecode.orc')

stack(
  chord("<C^7 A7 Dm7 Fm7>/2").dict('lefthand').voicing()
  .cutoff(sine.range(500,2000).round().slow(16))
  .euclidLegato(3,8).csound('FM1')
  ,
  note("<C2 A1 D2 F2>/2").ply(8).csound('Bass').gain("1 4 1 4")
  ,
  n("0 7 [4 3] 2".fast(2/3).off(".25 .125", add("<2 4 -3 -1>"))
  .slow(2).scale('A4 minor'))
  .clip(.25).csound('SynHarp')
  ,
  s("bd*2,[~ hh]*2,~ cp").bank('RolandTR909')
)
\`\`\`

---

## ❌ Do not use sample without loading and do not assume that a sample exists. only load existing samples !
this is a barebones strudle editor without any samples loaded by default.

---

## 🎯 Your Mission

When the user asks you to create a beat, do **not** just generate random code. Instead:

* Think musically: **what's the vibe? genre? instrumentation?**
* Build up the beat with **clear sections** (drums, bass, melody, fx)
* Use **realistic patterns**: don't overcomplicate the MiniTidal syntax
* Stick to known, real APIs

Be bold, but **keep it tight and playable**.

Output a **single self-contained beat pattern** in a 'beat' gated block, with musical layers and valid syntax. If you're unsure a method or sample exists — **don't use it.**
The beat block will be interpreted in the chat ui using the strudel editor so you syntax must be valid !
`

/**
 * 
available in dirt-samples : 
\`\`\`
808/{CB,CH,CL,CP,MA,RS}
808bd/{BD0000,BD0010,BD0025,BD0050,BD0075,BD1000,BD1010,BD1025,BD1050,BD1075,BD2500,BD2510,BD2525,BD2550,BD2575,BD5000,BD5010,BD5025,BD5050,BD5075,BD7500,BD7510,BD7525,BD7550,BD7575}
808cy/{CY0000,CY0010,CY0025,CY0050,CY0075,CY1000,CY1010,CY1025,CY1050,CY1075,CY2500,CY2510,CY2525,CY2550,CY2575,CY5000,CY5010,CY5025,CY5050,CY5075,CY7500,CY7510,CY7525,CY7550,CY7575}
808hc/{HC00,HC10,HC25,HC50,HC75}
808ht/{HT00,HT10,HT25,HT50,HT75}
808lc/{LC00,LC10,LC25,LC50,LC75}
808lt/{LT00,LT10,LT25,LT50,LT75}
808mc/{MC00,MC10,MC25,MC50,MC75}
808mt/{MT00,MT10,MT25,MT50,MT75}
808oh/{OH00,OH10,OH25,OH50,OH75}
808sd/{SD0000,SD0010,SD0025,SD0050,SD0075,SD1000,SD1010,SD1025,SD1050,SD1075,SD2500,SD2510,SD2525,SD2550,SD2575,SD5000,SD5010,SD5025,SD5050,SD5075,SD7500,SD7510,SD7525,SD7550,SD7575}
909/{BT0A0A7}
ab/{000_ab2closedhh,001_ab2crash,002_ab2hit1,003_ab2hit2,004_ab2kick1,005_ab2kick2,006_ab2openhh,007_ab2perc1,008_ab2perc2,009_ab2ride,010_ab2snare1,011_ab2snare2}
ade/{000_011112-bassline,001_011112-melody,002_20020506-01,003_abt,004_fan,005_fanbass,006_glass,007_microsound,008_rhythm,009_rise}
ades2/{000_01,001_02,002_03,003_04,004_05,005_06,006_07,007_08,008_09}
ades3/{01,02,03,04,05,06,07}
ades4/{01,02,03,04,05,06}
alex/{000_drumx1,001_drumx2}
alphabet/{a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z}
amencutup/{000_AMENCUT_001,001_AMENCUT_002,002_AMENCUT_003,003_AMENCUT_004,004_AMENCUT_005,005_AMENCUT_006,006_AMENCUT_007,007_AMENCUT_008,008_AMENCUT_009,009_AMENCUT_010,010_AMENCUT_011,011_AMENCUT_012,012_AMENCUT_013,013_AMENCUT_014,014_AMENCUT_015,015_AMENCUT_016,016_AMENCUT_017,017_AMENCUT_018,018_AMENCUT_019,019_AMENCUT_020,020_AMENCUT_021,021_AMENCUT_022,022_AMENCUT_023,023_AMENCUT_024,024_AMENCUT_025,025_AMENCUT_026,026_AMENCUT_027,027_AMENCUT_028,028_AMENCUT_029,029_AMENCUT_030,030_AMENCUT_031,031_AMENCUT_032}
armora/{000_beep,001_chopper,002_hiexp,003_jeepfire,004_loexp,005_tankeng,006_tankfire}
arp/{000_arp2,001_arp}
arpy/{arpy01,arpy02,arpy03,arpy04,arpy05,arpy06,arpy07,arpy08,arpy09,arpy10,arpy11}
auto/{000_break-kick,001_break-ride,002_break-sd,003_cymrev,004_kick,005_kick-ambient,006_sd,007_sd-ambient,008_shake1,009_shake2,010_shake3}
baa/{1,2,3,4,5,6,7}
baa2/{1,2,3,4,5,6,7}
bass/{000_bass1,001_bass2,002_bass3,003_bass4}
bass0/{000_0,001_1,002_2}
bass1/{18076__daven__01-sb-bass-hit-c,18077__daven__02-sb-bass-hit-c,18078__daven__03-sb-bass-hit-c,18079__daven__04-sb-bass-hit-c,18080__daven__05-sb-bass-hit-c,18081__daven__06-sb-bass-hit-c,18082__daven__07-sb-bass-hit-c,18083__daven__08-sb-bass-hit-c,18084__daven__09-sb-bass-hit-c,18085__daven__10-sb-bass-hit-c,18086__daven__11-sb-bass-hit-c,18087__daven__12-sb-bass-hit-c,18088__daven__13-sb-bass-hit-c,18089__daven__14-sb-bass-hit-c,18090__daven__15-sb-bass-hit-c,18091__daven__16-sb-bass-hit-c,18092__daven__17-sb-bass-hit-c,18093__daven__18-sb-bass-hit-c,18094__daven__19-sb-bass-hit-f,18095__daven__20-sb-bass-hit-f,18096__daven__21-sb-bass-hit-f,18097__daven__22-sb-bass-hit-f,18098__daven__23-sb-bass-hit-f,18099__daven__24-sb-bass-hit-f,18100__daven__25-sb-bass-hit-f,18101__daven__26-sb-bass-hit-f,18102__daven__27-sb-bass-hit-f,18103__daven__28-sb-bass-hit-f,18104__daven__29-sb-bass-hit-f,18105__daven__30-sb-bass-hit-f}
bass2/{69988__noizemassacre__hardcore-bass-1,69989__noizemassacre__hardcore-bass-2,69990__noizemassacre__hardcore-bass-3,69991__noizemassacre__hardcore-bass-4,69992__noizemassacre__hardcore-bass-5}
bass3/{83245__zgump__bass-0201,83246__zgump__bass-0202,83247__zgump__bass-0203,83248__zgump__bass-0204,83249__zgump__bass-0205,83250__zgump__bass-0206,83251__zgump__bass-0207,83252__zgump__bass-0208,83253__zgump__bass-0209,85056__zgump__reverse-bass-01,85057__zgump__reverse-bass-02}
bassdm/{001_BT0A0A7,002_BT0A0D0,003_BT0A0D3,004_BT0A0DA,005_BT0AAD0,006_BT0AADA,007_BT3A0D0,008_BT3A0D3,009_BT3A0D7,010_BT3A0DA,011_BT3AAD0,012_BT3AADA,013_BT7A0D0,014_BT7A0D3,015_BT7A0D7,016_BT7A0DA,017_BT7AAD0,018_BT7AADA,019_BTAA0D0,020_BTAA0D3,021_BTAA0D7,022_BTAA0DA,023_BTAAAD0,024_BTAAADA}
bassfoo/{000_0,001_1,002_2}
battles/{000_explo1,001_explo2}
bd/{BT0A0A7,BT0A0D0,BT0A0D3,BT0A0DA,BT0AAD0,BT0AADA,BT3A0D0,BT3A0D3,BT3A0D7,BT3A0DA,BT3AAD0,BT3AADA,BT7A0D0,BT7A0D3,BT7A0D7,BT7A0DA,BT7AAD0,BT7AADA,BTAA0D0,BTAA0D3,BTAA0D7,BTAA0DA,BTAAAD0,BTAAADA}
bend/{000_2,001_5,002_6,003_8}
bev/{00-mono,01-stereo}
bin/{000_bin1,001_0}
birds/{000_1,001_10,002_2,003_3,004_4,005_5,006_6,007_7,008_8,009_9}
birds3/{000_1,001_10,002_11,003_12,004_13,005_14,006_15,007_16,008_17,009_18,010_19,011_2,012_3,013_4,014_5,015_6,016_7,017_8,018_9}
bleep/{boip,checkpoint-hit,echo-blip-thing,harsh-whippleszoot,pc_beep,shortsaxish,simpletone,stereo-star-trek-pager,tiniest,tinynote,vidgame-bleep1,vidgame-bleep2,watch_beep}
blip/{000_blipp01,001_blipp02}
blue/{aya,howdoesitfeel}
bottle/{000_1,001_10,002_11,003_12,004_13,005_2,006_3,007_4,008_5,009_6,010_7,011_8,012_9}
breaks125/{015_sdstckbr,016_bllstmp}
breaks152/{000_AMEN}
breaks157/{000_PLEAD}
breaks165/{000_RAWCLN}
breath/{000_breath}
bubble/{000_bub0,001_bub1,002_bub2,003_bub3,004_bub4,005_bub5,006_bub6,007_bub7}
can/{000_1,001_10,002_11,003_12,004_13,005_14,006_2,007_3,008_4,009_5,010_6,011_7,012_8,013_9}
casio/{high,low,noise}
cb/{rytm-cb}
cc/{CSHD0,CSHD2,CSHD4,CSHD6,CSHD8,CSHDA}
chin/{000_tik1,001_tik2,002_tik3,003_tik4}
circus/{000_bounce,001_miss,002_pop}
clak/{000_clak1,001_clak2}
click/{000_click0,001_click1,002_click2,003_click3}
clubkick/{1,2,3,4,5}
co/{CLOP1,CLOP2,CLOP3,CLOP4}
coins/{coins}
control/{1,2}
cosmicg/{000_cg_att,001_cg_chnc,002_cg_dest,003_cg_ext,004_cg_gotb,005_cg_gotm,006_cg_gun,007_cg_m0,008_cg_m1,009_cg_m2,010_cg_m3,011_cg_m4,012_cg_m5,013_cg_m6,014_cg_m7}
cp/{HANDCLP0,HANDCLPA}
cr/{RIDED0,RIDED2,RIDED4,RIDED6,RIDED8,RIDEDA}
crow/{000_crow,001_crow2,002_crow3,003_crow4}
d/{000_d1,001_d2,002_d3,003_d4}
db/{dbs12closedhh,dbs12crash,dbs12hit1,dbs12hit2,dbs12hit3,dbs12kick1,dbs12kick2,dbs12openhh,dbs12perc1,dbs12perc2,dbs12ride,dbs12snare1,dbs12snare2}
diphone/{000_kd1_002,001_kd1_003,002_kd1_004,003_kd1_005,004_kd1_006,005_kd1_007,006_kd1_008,007_kd1_009,008_kd1_010,009_kd1_011,010_kd1_012,011_kd1_013,012_kd1_014,013_kd1_015,014_kd1_016,015_kd1_017,016_kd1_018,017_kd1_019,018_kd1_020,019_kd1_021,020_kd1_022,021_kd1_023,022_kd1_024,023_kd1_025,024_kd1_026,025_kd1_027,026_kd1_028,027_kd1_029,028_kd1_030,029_kd1_031,030_kd1_032,031_kd1_033,032_kd1_034,033_kd1_035,034_kd1_036,035_kd1_037,036_kd1_038,037_kd1_039}
diphone2/{000_kd1_399,001_kd1_400,002_kd1_401,003_kd1_402,004_kd1_403,005_kd1_404,006_kd1_405,007_kd1_406,008_kd3_010,009_kd3_011,010_kd3_012,011_kd3_013}
dist/{000_inddistb1,001_inddistb2,002_inddistb1ride,003_inddistb2ride,004_inddistb3,005_inddistb3ride,006_inddistb4,007_inddistb4ride,008_inddistb5,009_inddistb5ride,010_inddistb6,011_inddistb6ride,012_inddistb7,013_inddistb7ride,014_inddistb8,015_inddistb8ride}
dork2/{0,1,2,4}
dorkbot/{1,2}
dr/{000_002,001_003,002_004,003_005,004_006,005_008,006_009,007_010,008_011,009_014,010_015,011_016,012_017,013_019,014_023,015_024,016_025,017_026,018_027,019_028,020_029,021_030,022_031,023_032,024_033,025_034,026_035,027_036,028_037,029_038,030_039,031_040,032_041,033_042,034_043,035_044,036_045,037_046,038_047,039_048,040_049,041_050}
dr2/{000_DR110CHT,001_DR110CLP,002_DR110CYM,003_DR110KIK,004_DR110OHT,005_DR110SNR}
dr55/{000_DR55 hi hat,001_DR55 kick,002_DR55 rimshot,003_DR55 snare}
dr_few/{000_001,001_007,002_012,003_013,004_018,005_020,006_021,007_022}
drum/{000_drum1,001_drum2,002_drum3,003_drum4,004_drum5,005_drum6}
drumtraks/{000_DT Cabasa,001_DT Claps,002_DT Cowbell,003_DT Crash,004_DT Hat Closed,005_DT Hat Open,006_DT Kick,007_DT Ride,008_DT Rimshot,009_DT Snare,010_DT Tambourine,011_DT Tom1,012_DT Tom2}
e/{000_e1,001_e2,002_e3,003_e4,004_e5,005_e6,006_e7,007_e8}
east/{000_nipon_wood_block,001_ohkawa_mute,002_ohkawa_open,003_shime_hi,004_shime_hi_2,005_shime_mute,006_taiko_1,007_taiko_2,008_taiko_3}
electro1/{000_et1closedhh,001_et1crash,002_et1hit1,003_et1hit2,004_et1hit3,005_et1kick1,006_et1kick2,007_et1openhh,008_et1perc1,009_et1perc2,010_et1ride,011_et1snare1,012_et1snare2}
em2/{0,1,2,3,4,5}
erk/{000_123}
f/{000_f}
feel/{BD 04 d,HH 003b,Sd 139,Sd 180,Sd 223,hihat029a,sub}
feelfx/{blnk,boschwitz,bwawp,doing,laser-buzz,machine,silent,surfactant_15_xilo}
fest/{000_foo}
fire/{fire}
flick/{000_square-p,001_1,002_10,003_11,004_12,005_13,006_14,007_2,008_3,009_4,010_5,011_6,012_7,013_8,014_9,015_hi,016_square}
fm/{31seconds,808909stabs,badboy,bambaataa,break1,break2,break3,charly,electro1,electro2,femalevocal1,femalevocal2,femalevocal3,heyhey,pad,shakedown,stabs}
foo/{000_samthfdbrk,001_frtwbrak,002_fullbrk,003_drydrmmr,004_brtalhat,005_nicedrop,006_fastfaze,007_lkfnkybr,008_clnkrbrk,009_hrdlvbrk,010_dngrsbrk,011_eyebreak,012_vctrybrk,013_mrestick,014_thumpnbr,015_sdstckbr,016_bllstmp,017_gattabrk,018_nlzdelit,019_crshstmp,020_fststick,021_sqezdbrk,022_cnfssbrk,023_btstmpbr,024_rlltnbrk,025_pssbreak,026_vintage}
future/{000_808KICK4,001_808KICK9,002_Bd1_w,003_Bd2_w,004_Bd3_w,005_Johnson,006_Kick9,007_MKD03,008_MKD60601,009_MKDRCK05,010_MKDRCK06,011_MKDRCK07,012_Mhhcf3,013_Shake2,014_Shake4,015_lockett_conga_mute2,016_lockett_conga_open1}
gab/{gab01,gab02,gab03,gab04,gab05,gab06,gab07,gab08,gab09,gab10}
gabba/{000_0,001_1,002_2,003_3}
gabbaloud/{000_0,001_1,002_2,003_3}
gabbalouder/{000_0,001_1,002_2,003_3}
glasstap/{000_0,001_1,002_2}
glitch/{000_BD,001_CB,002_FX,003_HH,004_OH,005_P1,006_P2,007_SN}
glitch2/{000_BD,001_CB,002_FX,003_HH,004_OH,005_P1,006_P2,007_SN}
gretsch/{000_brushhitom,001_brushlotom,002_brushsnare,003_brushsnareghost,004_closedhat,005_closedhathard,006_cowbell,007_cymbalgrab,008_cymbalrub,009_flam,010_foothat,011_foothat2,012_hitom,013_kick,014_kicksnare,015_lotom,016_openclosedhat,017_openhat,018_ridebell,019_ridecymbal,020_snare,021_snareghost,022_snarehard,023_snareslack}
gtr/{0001_cleanC,0002_ovrdC,0003_distC}
h/{000_0_da0,001_0_da0-200%_1000_0_R,002_0_da0-50%_1000_0_R,003_1_da1,004_2_da2,005_3_tick,006_4_tock}
hand/{hand1-mono,hand11-mono,hand12-mono,hand13-mono,hand14-mono,hand15-mono,hand16-mono,hand17,hand2-mono,hand20,hand21-mono,hand22-mono,hand3-mono,hand4-mono,hand7-mono,hand8-mono,hand9-mono}
hardcore/{000_hcclosedhh,001_hchit1,002_hccrash,003_hchit2,004_hckick1,005_hckick2,006_hcopenhh,007_hcperc1,008_hcperc2,009_hcride,010_hcsnare1,011_hcsnare2}
hardkick/{VEC1 BD Distortion 06,VEC1 BD Distortion 37,VEC1 BD Distortion 39,VEC1 BD Distortion 41,VEC1 BD Distortion 52,VEC1 BD Distortion 53}
haw/{hawaiian-hh,hawaiian-kick,hawaiian-pop,hawaiian-sd,hawaiian-short1,hawaiian-short2}
hc/{HHCD0,HHCD2,HHCD4,HHCD6,HHCD8,HHCDA}
hh/{000_hh3closedhh,001_hh3crash,002_hh3hit1,003_hh3hit2,004_hh3hit3,005_hh3kick1,006_hh3kick2,007_hh3openhh,008_hh3rerc1,009_hh3rerc2,010_hh3ride,011_hh3snare1,012_hh3snare2}
hh27/{000_hh27closedhh,001_hh27crash,002_hh27hit1,003_hh27hit2,004_hh27hit3,005_hh27kick1,006_hh27kick2,007_hh27opendhh,008_hh27perc1,009_hh27perc2,010_hh27ride,011_hh27snare1,012_hh27snare2}
hit/{bandpass-blart,electro-pling1,laser-powered-sword,robot-fart,ufo-take-me-away,zap-to-crack}
hmm/{hmm}
ho/{HHOD0,HHOD2,HHOD4,HHOD6,HHOD8,HHODA}
hoover/{1,2,3,4,5,6}
house/{000_BD,001_CB,002_FX,003_HH,004_OH,005_P1,006_P2,007_SN}
ht/{HT0D0,HT0D3,HT0D7,HT0DA,HT3D0,HT3D3,HT3D7,HT3DA,HT7D0,HT7D3,HT7D7,HT7DA,HTAD0,HTAD3,HTAD7,HTADA}
if/{000_gab,001_gab2,002_snarl1b,003_snarl2b,004_snarl3b}
ifdrums/{ignorebd,ignorehh,ignoresd}
incoming/{000_Mattel  Snare,001_Mattel  Tom VHigh,002_Mattel Cymbal,003_Mattel Hi-Hat,004_Mattel Kick,005_Mattel Tom High,006_Mattel Tom Low,007_Mattel Tom VLow}
industrial/{000_01,001_02,002_03,003_04,004_05,005_06,006_07,007_08,008_09,009_10,010_11,011_12,012_13,013_14,014_15,015_16,016_17,017_18,018_19,019_20,020_21,021_22,022_23,023_24,024_25,025_26,026_27,027_28,028_29,029_30,030_31,031_32}
insect/{000_everglades_conehead,001_robust_shieldback,002_seashore_meadow_katydid}
invaders/{000_0,001_1,002_11,003_12,004_13,005_14,006_15,007_16,008_17,009_18,010_2,011_3,012_4,013_5,014_6,015_7,016_8,017_9}
jazz/{000_BD,001_CB,002_FX,003_HH,004_OH,005_P1,006_P2,007_SN}
jungbass/{000_deeep_n_low,001_fat_808_sub,002_fukubass2,003_glide_up_down_sub,004_gliding_808_sub,005_jungasubdown,006_junglerevbass,007_junglesine,008_junglesine2,009_junglesine3,010_mega_jungasubdown,011_shiphorn_tekstep_bass,012_short,013_sub_to_open_wah,014_sustained_2_octave,015_sustained_3_octave,016_sustained_deep_low,017_sweep_me_low_bass,018_synthy_round,019_thin_808_sub}
jungle/{jungle4closedhh,jungle4crash,jungle4hit1,jungle4hit2,jungle4hit3,jungle4kick1,jungle4kick2,jungle4openhh,jungle4perc1,jungle4perc2,jungle4ride,jungle4snare1,jungle4snare2}
juno/{00_juno_raw_low,01_juno_raw_mid,02_juno_raw_high,03_juno_chorus_low,04_juno_chorus_mid,05_juno_chorus_high,06_juno_release_low,07_juno_release_mid,08_juno_release_high,09_juno_pad_c_minor_filter,10_juno_pad_c_minor_no_filter,11_juno_pad_c_minor_noise}
jvbass/{000_01,001_02,002_03,003_04,004_05,005_06,006_07,007_08,008_09,009_10,010_11,011_12,012_13}
kicklinn/{Linn Kick 1}
koy/{01_left,02_right}
kurt/{000_kurt01,001_kurt02,002_kurt03,003_kurt04,004_kurt05,005_kurt06,006_kurt07}
latibro/{000_Sound2,001_Sound3,002_Sound4,003_Sound5,004_Sound6,005_Sound7,006_Sound8,007_Sound9}
led/{000_foo}
less/{bass2,hhxx,kicklesshuman,snare}
lighter/{000_0,001_1,002_2,003_3,004_4,005_5,006_6,007_7,008_8,009_9,010_10,011_11,012_12,013_13,014_14,015_15,016_16,017_17,018_18,019_19,020_20,021_21,022_22,023_23,024_24,025_25,026_26,027_27,028_28,029_29,030_30,031_31,032_32}
linnhats/{1,2,3,4,5,6}
lt/{LT0D0,LT0D3,LT0D7,LT0DA,LT3D0,LT3D3,LT3D7,LT3DA,LT7D0,LT7D3,LT7D7,LT7DA,LTAD0,LTAD3,LTAD7,LTADA}
made/{0,1,2,3,4,5,6}
made2/{output}
mash/{0,1}
mash2/{000_output,001_output2,002_output3,003_output4}
metal/{000_0,001_1,002_2,003_3,004_4,005_5,006_6,007_7,008_8,009_9}
miniyeah/{000_Sound0,001_Sound11,002_Sound23,003_Sound36}
monsterb/{000_jumpdown,001_laughter,002_tongue,003_warping,004_wolfman,005_zap}
moog/{000_Mighty Moog C2,001_Mighty Moog C3,002_Mighty Moog C4,003_Mighty Moog G1,004_Mighty Moog G2,005_Mighty Moog G3,006_Mighty Moog G4}
mouth/{000_1,001_10,002_11,003_12,004_13,005_14,006_15,007_2,008_3,009_4,010_5,011_6,012_7,013_8,014_9}
mp3/{000_mp30,001_mp31,002_mp32,003_mp33}
msg/{000_msg0,001_msg1,002_msg2,003_msg3,004_msg4,005_msg5,006_msg6,007_msg7,008_msg8}
mt/{MT0D0,MT0D3,MT0D7,MT0DA,MT3D0,MT3D3,MT3D7,MT3DA,MT7D0,MT7D3,MT7D7,MT7DA,MTAD0,MTAD3,MTAD7,MTADA}
mute/{000_FH A#2 SCF,001_FH A3 SCF,002_FH B3 SCF,003_FH B4 SC,004_FH B4 SCF,005_FH C#3 SC,006_FH C#3 SCF,007_FH C#5 SCF,008_FH C4 SCF,009_FH D#4 SCF,010_FH D#5 SCF,011_FH D3 SC,012_FH D3 SCF,013_FH E3 SC,014_FH E3 SCF,015_FH F#4 SC,016_FH F#4 SCF,017_FH F3 SC,018_FH F3 SCF,019_FH F5 SCF,020_FH G#2 SC,021_FH G#2 SCF,022_FH G#3 SC,023_FH G#3 SCF,024_FH G#4 SC,025_FH G#4 SCF,026_FH G2 SC,027_FH G2 SCF}
newnotes/{000_0,001_1,002_10,003_11,004_12,005_13,006_14,007_2,008_3,009_4,010_5,011_6,012_7,013_8,014_9}
noise/{000_noise}
noise2/{000_0,001_1,002_2,003_3,004_4,005_5,006_6,007_7}
notes/{000_0,001_1,002_10,003_11,004_12,005_13,006_14,007_2,008_3,009_4,010_5,011_6,012_7,013_8,014_9}
num/{00,01,02,03,04,05,06,07,08,09,10,11,12,13,14,15,16,17,18,19,20}
numbers/{0,1,2,3,4,5,6,7,8}
oc/{OPCL1,OPCL2,OPCL3,OPCL4}
odx/{000_Kick_1,001_DX_Snare_1,002_DXShaker,003_DXRimshot,004_DXRide,005_DX_Open_Hat,006_DX_Mid_Tom,007_DX_Med_Crash,008_DX_Low_Tom,009_DX_Lo_Crash,010_DX_Hi_Tom,011_DX_High_Crash,012_DX_Cl_Hat,013_DXClap,014_DX_Ax_Hat}
off/{000_01}
outdoor/{1,2,3,4,5,6}
pad/{alien-monolith-pad,angelpads,bellpad-harmonics}
padlong/{atmospheric-abduction}
pebbles/{90788__kmoon__pebbles-scrape-drag-foot}
perc/{000_perc0,001_perc1,002_perc2,003_perc3,004_perc4,005_perc5}
peri/{000_bd,001_bd-rev,002_hh2,003_hhx,004_ksh,005_sd,006_sd-rev,007_xbigclang,008_xbong,009_xbusket,010_xchinga,011_xfx1,012_xfx2,013_xfx3,014_xgillclank}
pluck/{BS A#2 PI,BS A1 PI,BS A3 PI,BS B1 PI,BS B3 PI,BS C3 PI,BS D#3 PI,BS D2 PI,BS D4 PI,BS E1 PI,BS E2 PI,BS F1 PI,BS F3 PI,BS G#2 PI,BS G1 PI,BS G2 PI,BS G3 PI}
popkick/{000_1,001_10,002_2,003_3,004_4,005_5,006_6,007_7,008_8,009_9}
print/{000_0,001_1,002_10,003_2,004_3,005_4,006_5,007_6,008_7,009_8,010_9}
proc/{000_2,001_3}
procshort/{000_1,001_10,002_11,003_4,004_5,005_7,006_8,007_9}
psr/{000_01,001_02,002_03,003_04,004_05,005_06,006_07,007_08,008_09,009_10,010_11,011_12,012_13,013_14,014_15,015_16,016_17,017_18,018_19,019_20,020_21,021_22,022_23,023_24,024_25,025_26,026_27,027_28,028_29,029_30}
rave/{AREUREADY,Babylon,cut,doh,giveit,ourcrew,prodigyloop,stabah}
rave2/{rave_bass01,rave_bass02,rave_bass03,rave_bass04}
ravemono/{Babylon,prodigyloop}
realclaps/{1,2,3,4}
reverbkick/{1}
rm/{RIM0,RIMA}
rs/{rytm-rs}
sax/{000_notes121a,001_notes121a2,002_notes121b,003_notes121bflat,004_notes121bflat2,005_notes121c,006_notes121c2,007_notes121csharp,008_notes121csharp2,009_notes121d,010_notes121e,011_notes121e2,012_notes121eflat,013_notes121eflat2,014_notes121f,015_notes121f2,016_notes121fsharp,017_notes121fsharp2,018_notes121g,019_notes121g2,020_notes121gsharp,021_notes121gsharp2}
sd/{rytm-00-hard,rytm-01-classic}
seawolf/{000_minehit,001_shiphit,002_torpedo}
sequential/{000_Tom Clap,001_Tom Crash,002_Tom Hat Closed,003_Tom Kick,004_Tom Openhat,005_Tom Snare,006_Tom Tom1,007_Tom Tom2}
sf/{000_bass,001_1,002_10,003_11,004_12,005_13,006_14,007_15,008_16,009_17,010_2,011_3,012_4,013_5,014_6,015_7,016_8,017_9}
sheffield/{jakeinsects}
short/{sampleoftheday-gtt-fx-synth-009,sampleoftheday-gtt-snare-drum-010,sampleoftheday-gtt-snare-drum-012,sampleoftheday-gtt-snare-drum-020,sampleoftheday-gtt-snare-drum-021}
sid/{000_bas2,001_bas,002_basd,003_blipp01,004_blipp02,005_high,006_high2,007_hihat01,008_hihat02,009_lofidrums,010_sidsnares,011_tdrum}
simplesine/{000_sine,001_sine2,002_sine3,003_sine4,004_sine5,005_sine6}
sitar/{000_d_maj_sitar_chorda,001_d_maj_sitar_chordb,002_d_maj_sitar_chordc,003_d_maj_sitar_chordd,004_d_maj_sitar_chorde,005_d_minor_sitar_chorda,006_d_minor_sitar_chordb,007_d_minor_sitar_chordc}
sn/{ST0T0S0,ST0T0S3,ST0T0S7,ST0T0SA,ST0T3S3,ST0T3S7,ST0T3SA,ST0T7S3,ST0T7S7,ST0T7SA,ST0TAS3,ST0TAS7,ST0TASA,ST3T0S0,ST3T0S3,ST3T0S7,ST3T0SA,ST3T3S3,ST3T3S7,ST3T3SA,ST3T7S3,ST3T7S7,ST3T7SA,ST3TAS3,ST3TAS7,ST3TASA,ST7T0S0,ST7T0S3,ST7T0S7,ST7T0SA,ST7T3S3,ST7T3S7,ST7T3SA,ST7T7S3,ST7T7S7,ST7T7SA,ST7TAS3,ST7TAS7,ST7TASA,STAT0S0,STAT0S3,STAT0S7,STAT0SA,STAT3S3,STAT3S7,STAT3SA,STAT7S3,STAT7S7,STAT7SA,STATAS3,STATAS7,STATASA}
space/{000_0,001_1,002_11,003_12,004_13,005_14,006_15,007_16,008_17,009_18,010_2,011_3,012_4,013_5,014_6,015_7,016_8,017_9}
speakspell/{000_1,001_10,002_11,003_12,004_2,005_3,006_4,007_5,008_6,009_7,010_8,011_9}
speech/{000_Sound10,001_Sound4,002_Sound5,003_Sound6,004_Sound7,005_Sound8,006_Sound9}
speechless/{000_a,001_pe,002_pepepe,003_pepepepepe,004_pepper,005_pepperpot,006_pick,007_pickle,008_po,009_te}
speedupdown/{000_Sound20,001_Sound21,002_Sound22,003_Sound23,004_Sound24,005_Sound25,006_Sound26,007_Sound27,008_Sound28}
stab/{000_stab1,001_stab10,002_stab11,003_stab12,004_stab13,005_stab14,006_stab15,007_stab16,008_stab17,009_stab18,010_stab19,011_stab2,012_stab20,013_stab21,014_stab22,015_stab23,016_stab3,017_stab4,018_stab5,019_stab6,020_stab7,021_stab8,022_stab9}
stomp/{000_0,001_0_2,002_1,003_2,004_3,005_5,006_6,007_7,008_8,009_9}
subroc3d/{000_01,001_02,002_03,003_04,004_05,005_06,006_07,007_08,008_09,009_11,010_12}
sugar/{000_bark,001_crab}
sundance/{000_bong,001_explsion,002_hatch,003_ping1,004_ping2,005_whoosh}
tabla/{000_bass_flick1,001_bass_flick2,002_bass_lick1,003_dead_hit1,004_dead_hit2,005_dead_hit3,006_d_sharp_hit,007_hi_flick1,008_hi_flick2,009_hi_hit1,010_hi_hit10,011_hi_hit2,012_hi_hit3,013_hi_hit4,014_hi_hit5,015_hi_hit6,016_hi_hit7,017_hi_hit8,018_hi_hit9,019_lower1_hit,020_lower2_hit,021_lower3_hit,022_lower4_hit,023_lower5_hit,024_lower6_hit,025_lower_hits_descending}
tabla2/{23645_loofa_A_001,23646_loofa_A_002,23647_loofa_A_003,23648_loofa_A_004,23649_loofa_A_005,23650_loofa_A_006,23651_loofa_A_007,23652_loofa_A_008,23653_loofa_A_009,23654_loofa_A_010,23655_loofa_A_011,23656_loofa_A_012,23657_loofa_A_013,23658_loofa_A_014,23659_loofa_A_015,23660_loofa_A_016,23661_loofa_A_017,23662_loofa_A_018,23663_loofa_A_019,23664_loofa_A_020,23665_loofa_A_021,23666_loofa_A_022,23667_loofa_A_023,23668_loofa_A_024,23669_loofa_A_025,23670_loofa_A_026,23671_loofa_A_027,23672_loofa_A_028,23673_loofa_bahia001,23674_loofa_bahia002,23675_loofa_bahia003,23676_loofa_bahia004,23677_loofa_bahia005,23678_loofa_bahia006,23679_loofa_bahia007,23680_loofa_bahia008,23681_loofa_bahia009,23682_loofa_bahia010,23683_loofa_bahia011,23684_loofa_bahia012,23685_loofa_bahia013,23686_loofa_bahia014,23687_loofa_bahia015,23688_loofa_bahia016,23689_loofa_bahia017,23690_loofa_bahia018}
tablex/{0,1,fuckable}
tacscan/{000_01,001_02,002_03,003_1up,004_credit,005_eexpl,006_eshot,007_flight1,008_flight2,009_flight3,010_flight4,011_flight5,012_formatn,013_pexpl,014_plaser,015_pship,016_sexpl,017_slaser,018_sthrust,019_tunnelh,020_tunnelw,021_warp}
tech/{tn1closedhh,tn1crash,tn1hit1,tn1hit2,tn1hit3,tn1kick1,tn1kick2,tn1openhh,tn1perc1,tn1perc2,tn1ride,tn1snare1,tn1snare2}
techno/{000_0,001_1,002_3,003_4,004_5,005_6,006_7}
tink/{000_tink1,001_tink2,002_tink3,003_tink4,004_tink5}
tok/{000_0,001_1,002_2,003_3}
toys/{000_ClassicalMusic,001_ClassicalMusic-Notes,002_ClassicalMusic-Words,003_Colors,004_Colors-Notes,005_Colors-Words,006_MusicalMedley,007_MusicalMedley-Notes,008_MusicalMedley-Words,009_Numbers,010_Numbers-Notes,011_Numbers-Words,012_ToyNotes}
trump/{000_tightstabb,001_tightstabblowoct,002_tightstabe,003_tightstabg,004_trumpfunk107a,005_trumpstabb,006_trumpstabblowoct,007_trumpstabe,008_trumpstabg,009_trumpstabschord,010_trumptightstabschord}
ul/{000_beep,001_little-whip,002_ulhh,003_ulkick,004_ulnoisey-kick,005_ulnoisey-run,006_ulnoisey-snare,007_ulsnare,008_ulsnare-reverb,009_ulsnare-reverse}
ulgab/{gab1,gab2,gab3,gab4,gab5}
uxay/{000_bar,001_erk,002_foo}
v/{000_b_blipp01,001_v_blipp02,002_v_perc3,003_v_perc5,004_v_snare01,005_v_snare02}
voodoo/{000_VoodooBass,001_VoodooHihat,002_VoodooRim,003_VoodooSnare,004_VoodooTom}
wind/{000_wind1,001_wind10,002_wind2,003_wind3,004_wind4,005_wind5,006_wind6,007_wind7,008_wind8,009_wind9}
wobble/{000_0}
world/{bd,gabbakick,sn}
xmas/{170535__cognito-perceptu__merry-christmas}
yeah/{000_Sound0,001_Sound10,002_Sound11,003_Sound13,004_Sound14,005_Sound15,006_Sound17,007_Sound18,008_Sound19,009_Sound20,010_Sound21,011_Sound22,012_Sound23,013_Sound24,014_Sound25,015_Sound26,016_Sound27,017_Sound28,018_Sound29,019_Sound3,020_Sound32,021_Sound33,022_Sound34,023_Sound35,024_Sound36,025_Sound4,026_Sound5,027_Sound6,028_Sound7,029_Sound8,030_Sound9}
\`\`\`
 */

export class BeatBlockRendererModule implements ControlModule {
  readonly id = "core-block-renderer-beat";
  private unregisterCallback?: () => void;
  private unregisterRuleCallback?: () => void;
  // @ts-expect-error will probably be used later
  private modApiRef?: LiteChatModApi;

  async initialize(): Promise<void> {
    // No initialization needed
  }

  register(modApi: LiteChatModApi): void {
    if (this.unregisterCallback) {
      console.warn(`[${this.id}] Already registered. Skipping.`);
      return;
    }

    const beatBlockRenderer: BlockRenderer = {
      id: this.id,
      supportedLanguages: ["beat"], // Specifically handles beat language
      priority: 15, // Higher priority than regular code renderer
      renderer: (context: BlockRendererContext) => {
        return React.createElement(BeatBlockRenderer, {
          code: context.code,
          isStreaming: context.isStreaming,
          interactionId: context.interactionId,
          blockId: context.blockId,
          module: this, // Pass module reference for enhanced context
        });
      },
    };

    this.unregisterCallback = modApi.registerBlockRenderer(beatBlockRenderer);

    this.unregisterRuleCallback = modApi.registerRule({
      id: `${this.id}-control-rule`,
      name: "Beat Pattern Control",
      content: BEAT_STRUDEL_CONTROL_PROMPT,
      type: "control",
      alwaysOn: false, // Disabled by default, user must opt-in via settings
      moduleId: this.id,
    });

    this.modApiRef = modApi;
  }

  destroy(): void {
    try {
      if (this.unregisterCallback) {
        this.unregisterCallback();
        this.unregisterCallback = undefined;
      }
      if (this.unregisterRuleCallback) {
        this.unregisterRuleCallback();
        this.unregisterRuleCallback = undefined;
      }
    } catch (error) {
      console.error(`[${this.id}] Error during cleanup:`, error);
    }
  }
} 