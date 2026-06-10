# fivem-greenscreener

A small script that allows you to take screenshots of every GTA clothing, prop/object, vehicle or weapon against a greenscreen.
You can use them for example in your inventory, clothing store, vehicle shop or weapon shop.

## Using the images

You are granted the freedom to utilize the images in your open-source projects with proper accreditation.
For commercial usage, please reach out to me on Discord to discuss the conditions.

## Key Features

- Capture screenshots of every GTA clothing item, including addon clothing
- Capture screenshots of all objects and props in GTA, including addon props
- Capture screenshots of every vehicle in GTA, including addon vehicles
- Capture screenshots of all GTA weapons as standalone props (109 weapons, saved as `weapon_pistol.png` etc.)
- Capture screenshots of weapon accessories/attachments — ped holding the weapon with each component applied
- **Web UI** — open `/greenscreener` to launch a panel with all options (clothing, vehicles, weapons, accessories, objects)
- **Pause / Resume / Stop** controls in the progress widget
- Screenshots are labeled comprehensively for seamless integration into your scripts
- Minimalistic progress UI for user convenience
- Almost completely invisible ped
- Customizable camera positions through configuration settings
- Option to enable cycling through texture variations
- Automatic removal of the greenscreen backdrop (courtesy of [@hakanesnn](https://github.com/hakanesnn))
- Utilizes a large greenscreen box (thanks to [@jimgordon20](https://github.com/jimgordon20/jim_g_green_screen))

## Planned Updates

- Feel free to share any ideas or suggestions for future enhancements!

## Installation

Simply clone the repository and place the resource in your resources folder.

**Do not use a subfolder like `resources/[scripts]` as it will cause the script to malfunction.**

## Dependencies

- [screenshot-basic](https://github.com/citizenfx/screenshot-basic)
- yarn

## Usage

### Web UI

Open the interface with `/greenscreener`. All screenshot options are available from there.
The panel lets you select a category, configure options, then launch. A progress widget appears during the process with **Pause**, **Resume** and **Stop** controls.

<a href="https://imgur.com/JnaQZkM"><img src="https://i.imgur.com/JnaQZkM.png" width="200"></a> 
<a href="https://imgur.com/phBMuHd"><img src="https://i.imgur.com/phBMuHd.png" width="200"></a>

---

### Screenshot all clothing

Execute the command `/screenshot` to initiate the clothing screenshot process.
Be patient as it may take some time to complete, and it's advisable not to interfere with your PC during this operation.


### Screenshot specific clothing

Utilize the command `/customscreenshot` to capture a specific clothing item, with optional custom camera settings specified in the format outlined in `config.json`.

`/customscreenshot [component] [drawable/all] [props/clothing] [male/female/both] [camerasettings(optional)]`

`/customscreenshot 11 17 clothing male {"fov": 55, "rotation": { "x": 0, "y": 0, "z": 15}, "zPos": 0.26}`

`/customscreenshot 11 all clothing male {"fov": 55, "rotation": { "x": 0, "y": 0, "z": 15}, "zPos": 0.26}`


### Screenshot objects/props

To screenshot objects or props, employ the command `/screenshotobject [hash]`.

Example Usage:
`/screenshotobject 2240524752`

### Screenshot vehicles

Capture screenshots of vehicles using `/screenshotvehicle [model/all] [primarycolor(optional)] [secondarycolor(optional)]`.

Example Usage:
`/screenshotvehicle all 1 1`

`/screenshotvehicle zentorno 1 1`

### Screenshot weapons

Capture screenshots of weapons as standalone props (saved to `images/weapons/`).

`/screenshotweapons all` — screenshots all 109 weapons defined in `config.json`

`/screenshotweapons weapon_pistol` — screenshots a single weapon

Images are named after the weapon (e.g. `weapon_pistol.png`).
The prop rotation is configurable via `greenScreenWeaponRotation` in `config.json`.

### Screenshot weapon accessories

Capture screenshots of each weapon accessory/attachment with the ped holding the weapon (saved to `images/weapon_components/{weapon_name}/`).

`/screenshotweaponcomponents all` — iterates every weapon + every component defined in `config.json`

`/screenshotweaponcomponents weapon_pistol` — only the accessories for that weapon

Images are named after the component (e.g. `COMPONENT_AT_PI_SUPP.png`).
The side-profile camera is configurable via `weaponComponentCameraSettings` (`fov`, `zOffset`, `distance`) in `config.json`.

## Examples

<img src="https://i.imgur.com/2WJyGgy.png" width="200"> <img src="https://i.imgur.com/aAQwU4d.png" width="200">
<img src="https://i.imgur.com/EqY5Inu.png" width="200"> <img src="https://i.imgur.com/ctTF9M9.png" width="200">
<img src="https://i.imgur.com/6qD7hF3.png" width="200"> <img src="https://i.imgur.com/xdMyGyk.png" width="200">