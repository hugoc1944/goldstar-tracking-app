# Goldstar Simulator — URL Parameter Reference

This document is the canonical reference for building links to the configurator.
It covers both directions: **tracking app → configurator** (inbound) and **configurator → quote form** (outbound).

---

## Direction 1: Tracking App → Configurator

Use these params when building a link that pre-fills the simulator from the tracking app.

Base URL: `https://<simulator-domain>/simulador?<params>`

### `model`
The variant to load. Skips the intro screen.

| Format | Examples |
|--------|---------|
| `ModelFamily_VN` | `Sterling_V3`, `DiplomataGold_V5`, `Europa_V2`, `Strong_V4` |

- Case-insensitive, separators flexible: `sterling_v3`, `Sterling-V3`, `sterling v3` all resolve.
- If the model is marked "Em Breve", the intro screen still shows but is skipped to the variant view.

---

### `finish` (alias: `acabamento`)
Profile/aluminum finish.

| URL value | Finish |
|-----------|--------|
| `cromado` | Cromado (Chrome) |
| `branco` | Branco |
| `brancomate` | BrancoMate |
| `preto` | Preto |
| `pretomate` | PretoMate |
| `gunmetal` | GunMetal |
| `cinza` | Cinza |
| `castanho` | Castanho |
| `cremeclaro` | CremeClaro |
| `cremeescuro` | CremeEscuro |
| `dourado` | Dourado |
| `anodizado` | Anodizado |
| `amarelo` | Amarelo |
| `azulclaro` | AzulClaro |
| `azulescuro` | AzulEscuro |
| `azulturquesa` | AzulTurquesa |
| `vermelho` | Vermelho |
| `bordeaux` | Bordeaux |
| `rosa` | Rosa |
| `verdeagua` | VerdeAgua |
| `verdefloresta` | VerdeFloresta |

---

### `glass` (alias: `vidro`)
Glass type.

| URL value | Glass type | Notes |
|-----------|-----------|-------|
| `transparente`, `clear`, `transparent` | Clear (Transparente) | |
| `fosco`, `frosted`, `matte`, `opaco` | Frosted (Fosco) | |
| `gris`, `fumado`, `smoke`, `escuro` | Mono Black (Gris) | **Use `gris`, not `mono_gris`** |
| `bronze` | Mono Bronze | |
| `verde`, `green` | Mono Green (Verde) | **Use `verde`, not `mono_verde`** |
| `vermelho`, `red` | Mono Red (Vermelho) | |
| `visiosun`, `uv` | Visiosun (privacy stripes) | |
| `canelado`, `flutes`, `canalete` | Flutes (vertical ribs) | |

> **Important:** The configurator sends `mono_gris` and `mono_verde` to the quote form, but the simulator parser reads `gris`/`verde`. Always use the values in the left column when building links TO the simulator.

---

### `handle` (alias: `puxador`)
Handle selection.

| URL value | Meaning |
|-----------|---------|
| `h1` .. `h8` | Handle 1 through 8 |
| `sem`, `none` | No handle |

---

### `acrylic` (alias: `acrilico`)
Acrylic panel type (only on models that support it).

| URL value | Acrylic |
|-----------|---------|
| `aguaviva` | Água Viva |
| `transparente`, `clear` | Policarbonato Transparente |
| `branco`, `white` | Policarbonato Branco |

---

### `serigrafia` (alias: `silk`)
Silk-screen / serigraph design.

| URL value | Design |
|-----------|--------|
| `SER001` .. `SER012` | Coleção Prime (case-insensitive) |
| `Quadro1` .. `Quadro3` | Coleção Quadros |
| `Elo1` .. `Elo4` | Coleção Elo |
| `Sereno` | Sereno |
| `nenhum`, `none` | No silk-screen |

---

### `serigrafiaColor` (aliases: `serColor`, `serCor`, `ink`)
Ink color override for silk-screens (applies to Coleção Prime and Quadros).

| URL value | Meaning |
|-----------|---------|
| `padrao`, `default` | Default ink color for the design |
| `acabamento`, `finish` | Use the same color as the profile finish |
| Any finish slug (e.g. `dourado`, `preto`) | Use that specific color |

---

### `complemento` (aliases: `complementos`, `complement`)
Comma-separated list of active accessories. **Both `complemento` and `complementos` are accepted.**

| Value | Accessory |
|-------|-----------|
| `vision` | Vision towel rack |
| `toalheiro1` | Toalheiro 1 |
| `prateleira` | Corner shelf |
| `nenhum`, `none` | No accessories |

Example: `complemento=vision,prateleira`

Sub-parameters per accessory — read below.

---

#### Sub-params for `vision`

| Param | Values | Meaning |
|-------|--------|---------|
| `barColor` | `glass`/`vidro`, `white`/`branco`, `black`/`preto`/`preto_mate` | Vision bar color |
| `visionSupport` | Any finish slug (e.g. `cromado`, `preto`, `anodizado`) | Support arm finish |

---

#### Sub-params for `toalheiro1`

| Param | Aliases | Values | Meaning |
|-------|---------|--------|---------|
| `towelColorMode` | `towel`, `towelColor` | `padrao`, `acabamento` | Bar color mode |

---

#### Sub-params for `prateleira`

| Param | Aliases | Values | Meaning |
|-------|---------|--------|---------|
| `shelf` | `shelfColor`, `shelfColorMode` | `padrao`, `acabamento` | Shelf metal color mode |
| `corner` | `cornerChoice` | `corner1`, `corner2` | Which corner (default: `corner1`) |
| `altura` | `shelfHeight`, `alturaPrateleira` | `20`..`100` | Height as percentage (20 = lowest, 100 = highest) |

---

### `painelCorner` (aliases: `cantovidro`, `canto`)
Glass panel corner style. **Only applies to `Painel_V2`.**

| URL value | Meaning |
|-----------|---------|
| `reto`, `straight` | Straight (90°) corner |
| *(absent)* | Rounded corner (default) |

> Only include this parameter when the corner is straight. Absence means rounded (the default).

---

### `fixingBarMode` (aliases: `fixingbar`, `fixbar`)
Fixing/support bar color mode.

| URL value | Meaning |
|-----------|---------|
| `padrao`, `default` | Default bar color |
| `acabamento`, `finish` | Match the profile finish |
| `off`, `none`, `false`, `0` | Disable/hide the bar |

---

## Direction 2: Configurator → Quote Form

When the user clicks "Pedir Orçamento", the configurator builds a URL to:
`https://tracking.mfn.pt/orcamentos/novo?<params>`

These are the param names and values the **configurator sends**. The tracking app should be able to read all of these.

| Param | Example value | Notes |
|-------|--------------|-------|
| `model` | `sterling_v3` | Always lowercase |
| `finish` | `azulescuro`, `cromado` | Lowercase slug |
| `glass` | `transparente`, `fosco`, `mono_gris`, `mono_verde`, `mono_red`, `mono_bronze`, `mono_visiosun`, `mono_flutes` | See note below |
| `acrylic` | `policarbonato_branco`, `policarbonato_transparente`, `aguaviva` | Only set if non-clear |
| `handle` | `h2`, `sem` | |
| `serigrafia` | `ser005_silkscreen`, `quadro1`, `elo2` | |
| `serigrafiaColor` | `padrao`, `dourado` | |
| `complemento` | `vision,prateleira` | Comma-separated |
| `barColor` | `glass`, `white`, `black` | English only |
| `visionSupport` | `cromado`, `preto` | Finish slug |
| `towelColorMode` | `padrao`, `acabamento` | |
| `shelfColorMode` | `padrao`, `acabamento` | |
| `altura` | `60` | 20..100 |
| `fixingBarMode` | `padrao`, `acabamento` | |
| `painelCorner` | `reto` | Only for Painel_V2 when straight corner selected |

> **Glass inconsistency to be aware of:** The configurator sends `mono_gris` (not `gris`) for black glass, and `mono_verde` (not `verde`) for green glass. If the tracking app ever round-trips these values back to the configurator, use `gris` and `verde` (the inbound values) — not the `mono_*` form that the configurator emits.

---

## Complete Example

```
/simulador
  ?model=Sterling_V3
  &finish=azulescuro
  &handle=h2
  &glass=gris
  &fixingBarMode=acabamento
  &complemento=vision,prateleira
  &barColor=preto_mate
  &visionSupport=preto
  &shelf=acabamento
  &altura=60
```

Expected state after load:
- Model: Sterling V3
- Finish: AzulEscuro
- Handle: Handle 2
- Glass: Mono Black (Gris)
- Fixing bar: visible, matching finish color
- Vision towel rack: active, black bar, Preto support arms
- Corner shelf: corner1, matching finish color, at ~60% height

---

## Inconsistencies to Fix in the Tracking App

The tracking app has three places that build simulator links. They should all use:

| Feature | Correct inbound value | Wrong values seen |
|---------|----------------------|-------------------|
| Black glass | `gris` | `mono_preto`, `mono_gris`, `escuro` |
| Green glass | `verde` | `mono_verde` |
| Black Vision bar | `preto` or `preto_mate` | `black` also works |
| White Vision bar | `branco` | `white` also works |
| Glass Vision bar | `vidro` | `glass` also works |
| Frosted glass | `fosco` | `frosted`, `matte` also work |
| BrancoMate finish | `brancomate` | `branco_mate` |
| PretoMate finish | `pretomate` | `preto_mate`, `preto_fosco` |
| Complemento list | `complemento=vision,prateleira` | `complementos=...` also now works |
