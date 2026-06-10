/// <reference types="@citizenfx/client" />

const config = JSON.parse(LoadResourceFile(GetCurrentResourceName(), 'config.json'));

const Delay = (ms) => new Promise((res) => setTimeout(res, ms));

let cam;
let camInfo;
let ped;
let interval;
let hudHideTick = null;
const playerId = PlayerId();

// Screenshot state machine
let screenshotState = 'idle'; // 'idle' | 'running' | 'paused' | 'stopped'

async function waitIfPaused() {
	while (screenshotState === 'paused') await Delay(100);
	return screenshotState !== 'stopped';
}
let QBCore = null;

if (config.useQBVehicles) {
	QBCore = exports[config.coreResourceName].GetCoreObject();
}

// Mapping des composants/props GTA vers l'arborescence d'icônes de la ressource "clothes"
// (cf. clothes/cfg.lua -> Config.ClothingComponents / Config.AccessoryComponents et
//  clothes/web/script.js -> icons/${category}/${sex}/${drawable}.png)
const clothesClothingFolders = {
	1: 'mask',    // Masque
	3: 'arms',    // Bras
	4: 'pants',   // Pantalon
	5: 'bags',    // Sac
	6: 'shoes',   // Chaussures
	7: 'chain',   // Chaîne / Accessoire
	8: 'tshirt',  // T-Shirt
	9: 'bproof',  // Gilet
	10: 'sticker', // Sticker
	11: 'torso',  // Haut / Veste
};
const clothesPropFolders = {
	0: 'hat',       // Chapeau
	1: 'glasses',   // Lunettes
	2: 'ears',      // Oreilles
	6: 'watches',   // Montres
	7: 'bracelets', // Bracelets
};

async function takeScreenshotForComponent(pedType, type, component, drawable, texture, cameraSettings) {
	const cameraInfo = cameraSettings ? cameraSettings : config.cameraSettings?.[type]?.[component];

	if (!cameraInfo) {
		console.warn(`[greenscreener] No camera settings for ${type} component ${component}, skipping.`);
		return;
	}

	setWeatherTime();

	await Delay(500);

	if (!camInfo || camInfo.zPos !== cameraInfo.zPos || camInfo.fov !== cameraInfo.fov) {
		camInfo = cameraInfo;

		if (cam) {
			DestroyAllCams(true);
			DestroyCam(cam, true);
			cam = null;
		}

		SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
		SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);

		await Delay(50);

		const [playerX, playerY, playerZ] = GetEntityCoords(ped);
		const [fwdX, fwdY, fwdZ] = GetEntityForwardVector(ped);

		const fwdPos = {
			x: playerX + fwdX * 1.2,
			y: playerY + fwdY * 1.2,
			z: playerZ + fwdZ + camInfo.zPos,
		};

		cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', fwdPos.x, fwdPos.y, fwdPos.z, 0, 0, 0, camInfo.fov, true, 0);

		PointCamAtCoord(cam, playerX, playerY, playerZ + camInfo.zPos);
		SetCamActive(cam, true);
		RenderScriptCams(true, false, 0, true, false, 0);
	}

	await Delay(50);

	SetEntityRotation(ped, camInfo.rotation.x, camInfo.rotation.y, camInfo.rotation.z, 2, false);

	// Sortie au format attendu par la ressource "clothes": <category>/<sex>/<drawable>.png
	const sex = pedType === 'male' ? 'm' : 'f';
	const folder = type === 'PROPS' ? clothesPropFolders[component] : clothesClothingFolders[component];
	if (folder) {
		emitNet('takeScreenshot', `${drawable}${texture ? `_${texture}` : ''}`, `${folder}/${sex}`);
	} else {
		// Composant non mappé: on garde l'ancien nommage à plat
		emitNet('takeScreenshot', `${pedType}_${type == 'PROPS' ? 'prop_' : ''}${component}_${drawable}${texture ? `_${texture}`: ''}`, 'clothing');
	}
	await Delay(2000);
	return;
}

async function takeScreenshotForObject(object, hash, folder = 'objects', filename = null) {

	setWeatherTime();

	await Delay(500);

	if (cam) {
		DestroyAllCams(true);
		DestroyCam(cam, true);
		cam = null;
	}

	let [[minDimX, minDimY, minDimZ], [maxDimX, maxDimY, maxDimZ]] = GetModelDimensions(hash);
	let modelSize = {
		x: maxDimX - minDimX,
		y: maxDimY - minDimY,
		z: maxDimZ - minDimZ
	}
	let fov = Math.min(Math.max(modelSize.x, modelSize.z) / 0.15 * 10, 60);


	const [objectX, objectY, objectZ] = GetEntityCoords(object, false);
	const [fwdX, fwdY, fwdZ] = GetEntityForwardVector(object);

	const center = {
		x: objectX + (minDimX + maxDimX) / 2,
		y: objectY + (minDimY + maxDimY) / 2,
		z: objectZ + (minDimZ + maxDimZ) / 2,
	}

	const fwdPos = {
		x: center.x + fwdX * 1.2 + Math.max(modelSize.x, modelSize.z) / 2,
		y: center.y + fwdY * 1.2 + Math.max(modelSize.x, modelSize.z) / 2,
		z: center.z + fwdZ,
	};

	cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', fwdPos.x, fwdPos.y, fwdPos.z, 0, 0, 0, fov, true, 0);

	PointCamAtCoord(cam, center.x, center.y, center.z);
	SetCamActive(cam, true);
	RenderScriptCams(true, false, 0, true, false, 0);

	await Delay(50);

	emitNet('takeScreenshot', filename ?? `${hash}`, folder);

	await Delay(2000);

	return;

}

async function takeScreenshotForWeaponComponent(pedRef, weaponName, componentName) {
	setWeatherTime();

	await Delay(500);

	if (cam) {
		DestroyAllCams(true);
		DestroyCam(cam, true);
		cam = null;
	}

	const settings = config.weaponComponentCameraSettings ?? {};
	const fov = settings.fov ?? 45;
	const zOffset = settings.zOffset ?? 0.65;
	const dist = settings.distance ?? 1.3;

	const [pedX, pedY, pedZ] = GetEntityCoords(pedRef);
	const [fwdX, fwdY] = GetEntityForwardVector(pedRef);

	// Camera to the ped's right (90° clockwise from forward)
	const rightX = fwdY;
	const rightY = -fwdX;

	cam = CreateCamWithParams(
		'DEFAULT_SCRIPTED_CAMERA',
		pedX + rightX * dist,
		pedY + rightY * dist,
		pedZ + zOffset,
		0, 0, 0, fov, true, 0
	);

	PointCamAtCoord(cam, pedX + fwdX * 0.35, pedY + fwdY * 0.35, pedZ + zOffset);
	SetCamActive(cam, true);
	RenderScriptCams(true, false, 0, true, false, 0);

	await Delay(50);

	emitNet('takeScreenshot', componentName, `weapon_components/${weaponName}`);

	await Delay(2000);
}

async function takeScreenshotForVehicle(vehicle, hash, model) {
	setWeatherTime();

	await Delay(500);

	if (cam) {
		DestroyAllCams(true);
		DestroyCam(cam, true);
		cam = null;
	}

	let [[minDimX, minDimY, minDimZ], [maxDimX, maxDimY, maxDimZ]] = GetModelDimensions(hash);
	let modelSize = {
		x: maxDimX - minDimX,
		y: maxDimY - minDimY,
		z: maxDimZ - minDimZ
	}
	let fov = Math.min(Math.max(modelSize.x, modelSize.y, modelSize.z) / 0.15 * 10, 60);

	const [objectX, objectY, objectZ] = GetEntityCoords(vehicle, false);

	const center = {
		x: objectX + (minDimX + maxDimX) / 2,
		y: objectY + (minDimY + maxDimY) / 2,
		z: objectZ + (minDimZ + maxDimZ) / 2,
	}

	let camPos = {
		x: center.x + (Math.max(modelSize.x, modelSize.y, modelSize.z) + 2) * Math.cos(340),
		y: center.y + (Math.max(modelSize.x, modelSize.y, modelSize.z) + 2) * Math.sin(340),
		z: center.z + modelSize.z / 2,
	}

	cam = CreateCamWithParams('DEFAULT_SCRIPTED_CAMERA', camPos.x, camPos.y, camPos.z, 0, 0, 0, fov, true, 0);

	PointCamAtCoord(cam, center.x, center.y, center.z);
	SetCamActive(cam, true);
	RenderScriptCams(true, false, 0, true, false, 0);

	await Delay(50);

	emitNet('takeScreenshot', `${model}`, 'vehicles');

	await Delay(2000);

	return;

}

function SetPedOnGround() {
	const [x, y, z] = GetEntityCoords(ped, false);
	const [retval, ground] = GetGroundZFor_3dCoord(x, y, z, 0, false);
	SetEntityCoords(ped, x, y, ground, false, false, false, false);

}

function ClearAllPedProps() {
	for (const prop of Object.keys(config.cameraSettings.PROPS)) {
		ClearPedProp(ped, parseInt(prop));
	}
}

async function ResetPedComponents() {

	if (config.debug) console.log(`DEBUG: Resetting Ped Components`);

	SetPedDefaultComponentVariation(ped);

	await Delay(150);

	SetPedComponentVariation(ped, 0, 0, 1, 0); // Head
	SetPedComponentVariation(ped, 1, 0, 0, 0); // Mask
	SetPedComponentVariation(ped, 2, -1, 0, 0); // Hair
	SetPedComponentVariation(ped, 7, 0, 0, 0); // Accessories
	SetPedComponentVariation(ped, 5, 0, 0, 0); // Bags
	SetPedComponentVariation(ped, 6, -1, 0, 0); // Shoes
	SetPedComponentVariation(ped, 9, 0, 0, 0); // Armor
	SetPedComponentVariation(ped, 3, -1, 0, 0); // Torso
	SetPedComponentVariation(ped, 8, -1, 0, 0); // Undershirt
	SetPedComponentVariation(ped, 4, -1, 0, 0); // Legs
	SetPedComponentVariation(ped, 11, -1, 0, 0); // Top
	SetPedHairColor(ped, 45, 15);

	ClearAllPedProps();

	return;
}

// Masque le HUD/radar pendant la capture: sans ça, la boussole ("N") et la
// minimap restent visibles dans le screenshot et faussent le recadrage côté
// serveur (la boîte englobante non-transparente inclut ces éléments du coin
// bas-gauche), ce qui décale le sujet dans un coin de l'image.
function startHidingHud() {
	DisplayRadar(false);
	if (hudHideTick === null) {
		hudHideTick = setTick(() => {
			HideHudAndRadarThisFrame();
			// Le fil de notifications ("the feed") est un Scaleform séparé que
			// HideHudAndRadarThisFrame ne couvre pas: une notif (paycheck, etc.)
			// qui apparaît en plein run réélargit la boîte englobante côté serveur
			// et décale le sujet. On le masque donc explicitement chaque frame.
			ThefeedHideThisFrame();
		});
	}
}

function stopHidingHud() {
	if (hudHideTick !== null) {
		clearTick(hudHideTick);
		hudHideTick = null;
	}
	DisplayRadar(true);
}

function setWeatherTime() {
	if (config.debug) console.log(`DEBUG: Setting Weather & Time`);
	SetRainLevel(0.0);
	SetWeatherTypePersist('EXTRASUNNY');
	SetWeatherTypeNow('EXTRASUNNY');
	SetWeatherTypeNowPersist('EXTRASUNNY');
	NetworkOverrideClockTime(18, 0, 0);
	NetworkOverrideClockMillisecondsPerGameMinute(1000000);
}

function stopWeatherResource() {
	if (config.debug) console.log(`DEBUG: Stopping Weather Resource`);
	if ((GetResourceState('qb-weathersync') == 'started') || (GetResourceState('qbx_weathersync') == 'started')) {
		TriggerEvent('qb-weathersync:client:DisableSync');
		return true;
	} else if (GetResourceState('weathersync') == 'started') {
		TriggerEvent('weathersync:toggleSync')
		return true;
	} else if (GetResourceState('esx_wsync') == 'started') {
		SendNUIMessage({
			error: 'weathersync',
		});
		return false;
	} else if (GetResourceState('cd_easytime') == 'started') {
		TriggerEvent('cd_easytime:PauseSync', false)
		return true;
	} else if (GetResourceState('vSync') == 'started' || GetResourceState('Renewed-Weathersync') == 'started') {
		TriggerEvent('vSync:toggle', false)
		return true;
	}
	return true;
};

function startWeatherResource() {
	if (config.debug) console.log(`DEBUG: Starting Weather Resource again`);
	if ((GetResourceState('qb-weathersync') == 'started') || (GetResourceState('qbx_weathersync') == 'started')) {
		TriggerEvent('qb-weathersync:client:EnableSync');
	} else if (GetResourceState('weathersync') == 'started') {
		TriggerEvent('weathersync:toggleSync')
	} else if (GetResourceState('cd_easytime') == 'started') {
		TriggerEvent('cd_easytime:PauseSync', true)
	} else if (GetResourceState('vSync') == 'started' || GetResourceState('Renewed-Weathersync') == 'started') {
		TriggerEvent('vSync:toggle', true)
	}
}

async function LoadComponentVariation(ped, component, drawable, texture) {
	texture = texture || 0;

	if (config.debug) console.log(`DEBUG: Loading Component Variation: ${component} ${drawable} ${texture}`);

	SetPedPreloadVariationData(ped, component, drawable, texture);
	while (!HasPedPreloadVariationDataFinished(ped)) {
		await Delay(50);
	}
	SetPedComponentVariation(ped, component, drawable, texture, 0);

	return;
}

async function LoadPropVariation(ped, component, prop, texture) {
	texture = texture || 0;

	if (config.debug) console.log(`DEBUG: Loading Prop Variation: ${component} ${prop} ${texture}`);

	SetPedPreloadPropData(ped, component, prop, texture);
	while (!HasPedPreloadPropDataFinished(ped)) {
		await Delay(50);
	}
	ClearPedProp(ped, component);
	SetPedPropIndex(ped, component, prop, texture, 0);

	return;
}

function createGreenScreenVehicle(vehicleHash, vehicleModel) {
	return new Promise(async(resolve, reject) => {
		if (config.debug) console.log(`DEBUG: Spawning Vehicle ${vehicleModel}`);
		const timeout = setTimeout(() => {
			resolve(null);
		}, config.vehicleSpawnTimeout)
		if (!HasModelLoaded(vehicleHash)) {
			RequestModel(vehicleHash);
			while (!HasModelLoaded(vehicleHash)) {
				await Delay(100);
			}
		}
		const vehicle = CreateVehicle(vehicleHash, config.greenScreenVehiclePosition.x, config.greenScreenVehiclePosition.y, config.greenScreenVehiclePosition.z, 0, true, true);
		if (vehicle === 0) {
			clearTimeout(timeout);
			resolve(null);
		}
		clearTimeout(timeout);
		resolve(vehicle);
	});
}


RegisterCommand('screenshot', async (source, args) => {
	const gender = args[0]?.toLowerCase();
	let modelHashes;
	screenshotState = 'running';
	if (gender === 'male') {
		modelHashes = [GetHashKey('mp_m_freemode_01')];
	} else if (gender === 'female') {
		modelHashes = [GetHashKey('mp_f_freemode_01')];
	} else {
		modelHashes = [GetHashKey('mp_m_freemode_01'), GetHashKey('mp_f_freemode_01')];
	}

	SendNUIMessage({
		start: true,
	});

	if (!stopWeatherResource()) return;

	DisableIdleCamera(true);
	startHidingHud();


	await Delay(100);

	for (const modelHash of modelHashes) {
		if (IsModelValid(modelHash)) {
			if (!HasModelLoaded(modelHash)) {
				RequestModel(modelHash);
				while (!HasModelLoaded(modelHash)) {
					await Delay(100);
				}
			}

			SetPlayerModel(playerId, modelHash);
			await Delay(150);
			SetModelAsNoLongerNeeded(modelHash);

			await Delay(150);

			ped = PlayerPedId();

			const pedType = modelHash === GetHashKey('mp_m_freemode_01') ? 'male' : 'female';
			SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
			SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
			FreezeEntityPosition(ped, true);
			await Delay(50);
			SetPlayerControl(playerId, false);

			interval = setInterval(() => {
				ClearPedTasksImmediately(ped);
			}, 1);

			for (const type of Object.keys(config.cameraSettings)) {
				for (const stringComponent of Object.keys(config.cameraSettings[type])) {
					await ResetPedComponents();
					await Delay(150);
					const component = parseInt(stringComponent);
					if (type === 'CLOTHING') {
						const drawableVariationCount = GetNumberOfPedDrawableVariations(ped, component);
						for (let drawable = 0; drawable < drawableVariationCount; drawable++) {
							const textureVariationCount = GetNumberOfPedTextureVariations(ped, component, drawable);
							SendNUIMessage({
								type: config.cameraSettings[type][component]?.name ?? `Component ${component}`,
								value: drawable,
								max: drawableVariationCount,
							});
							if (config.includeTextures) {
								for (let texture = 0; texture < textureVariationCount; texture++) {
									await LoadComponentVariation(ped, component, drawable, texture);
									await takeScreenshotForComponent(pedType, type, component, drawable, texture);
								}
							} else {
								await LoadComponentVariation(ped, component, drawable);
								await takeScreenshotForComponent(pedType, type, component, drawable);
							}
							if (!await waitIfPaused()) break;
						}
					} else if (type === 'PROPS') {
						const propVariationCount = GetNumberOfPedPropDrawableVariations(ped, component);
						for (let prop = 0; prop < propVariationCount; prop++) {
							const textureVariationCount = GetNumberOfPedPropTextureVariations(ped, component, prop);
							SendNUIMessage({
								type: config.cameraSettings[type][component]?.name ?? `Component ${component}`,
								value: prop,
								max: propVariationCount,
							});

							if (config.includeTextures) {
								for (let texture = 0; texture < textureVariationCount; texture++) {
									await LoadPropVariation(ped, component, prop, texture);
									await takeScreenshotForComponent(pedType, type, component, prop, texture);
								}
							} else {
								await LoadPropVariation(ped, component, prop);
								await takeScreenshotForComponent(pedType, type, component, prop);
							}
							if (!await waitIfPaused()) break;
						}
					}
					if (screenshotState === 'stopped') break;
				}
				if (screenshotState === 'stopped') break;
			}
			SetModelAsNoLongerNeeded(modelHash);
			SetPlayerControl(playerId, true);
			FreezeEntityPosition(ped, false);
			clearInterval(interval);
			if (screenshotState === 'stopped') break;
		}
	}
	const wasStopped = screenshotState === 'stopped';
	screenshotState = 'idle';
	SetPedOnGround();
	startWeatherResource();
	SendNUIMessage(wasStopped ? { stopped: true } : { end: true });
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	stopHidingHud();
	camInfo = null;
	cam = null;
});

RegisterCommand('customscreenshot', async (source, args) => {

	const type = args[2].toUpperCase();
	const component = parseInt(args[0]);
	let drawable = args[1].toLowerCase() == 'all' ? args[1].toLowerCase() : parseInt(args[1]);
	let prop = args[1].toLowerCase() == 'all' ? args[1].toLowerCase() : parseInt(args[1]);
	const gender = args[3].toLowerCase();
	let cameraSettings;


	let modelHashes;

	if (gender == 'male') {
		modelHashes = [GetHashKey('mp_m_freemode_01')];
	} else if (gender == 'female') {
		modelHashes = [GetHashKey('mp_f_freemode_01')];
	} else {
		modelHashes = [GetHashKey('mp_m_freemode_01'), GetHashKey('mp_f_freemode_01')];
	}

	if (args[4] != null) {
		cameraSettings = ''
		for (let i = 4; i < args.length; i++) {
			cameraSettings += args[i] + ' ';
		}

		cameraSettings = JSON.parse(cameraSettings);
	}


	if (!stopWeatherResource()) return;

	DisableIdleCamera(true);
	startHidingHud();


	await Delay(100);

	for (const modelHash of modelHashes) {
		if (IsModelValid(modelHash)) {
			if (!HasModelLoaded(modelHash)) {
				RequestModel(modelHash);
				while (!HasModelLoaded(modelHash)) {
					await Delay(100);
				}
			}

			SetPlayerModel(playerId, modelHash);
			await Delay(150);
			SetModelAsNoLongerNeeded(modelHash);

			await Delay(150);

			ped = PlayerPedId();

			interval = setInterval(() => {
				ClearPedTasksImmediately(ped);
			}, 1);

			const pedType = modelHash === GetHashKey('mp_m_freemode_01') ? 'male' : 'female';
			SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
			SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
			FreezeEntityPosition(ped, true);
			await Delay(50);
			SetPlayerControl(playerId, false);

			ResetPedComponents();
			await Delay(150);

			if (drawable == 'all') {
				SendNUIMessage({
					start: true,
				});
				if (type === 'CLOTHING') {
					const drawableVariationCount = GetNumberOfPedDrawableVariations(ped, component);
					for (drawable = 0; drawable < drawableVariationCount; drawable++) {
						const textureVariationCount = GetNumberOfPedTextureVariations(ped, component, drawable);
						SendNUIMessage({
							type: config.cameraSettings[type][component]?.name ?? `Component ${component}`,
							value: drawable,
							max: drawableVariationCount,
						});
						if (config.includeTextures) {
							for (let texture = 0; texture < textureVariationCount; texture++) {
								await LoadComponentVariation(ped, component, drawable, texture);
								await takeScreenshotForComponent(pedType, type, component, drawable, texture, cameraSettings);
							}
						} else {
							await LoadComponentVariation(ped, component, drawable);
							await takeScreenshotForComponent(pedType, type, component, drawable, null, cameraSettings);
						}
					}
				} else if (type === 'PROPS') {
					const propVariationCount = GetNumberOfPedPropDrawableVariations(ped, component);
					for (prop = 0; prop < propVariationCount; prop++) {
						const textureVariationCount = GetNumberOfPedPropTextureVariations(ped, component, prop);
						SendNUIMessage({
							type: config.cameraSettings[type][component]?.name ?? `Component ${component}`,
							value: prop,
							max: propVariationCount,
						});

						if (config.includeTextures) {
							for (let texture = 0; texture < textureVariationCount; texture++) {
								await LoadPropVariation(ped, component, prop, texture);
								await takeScreenshotForComponent(pedType, type, component, prop, texture, cameraSettings);
							}
						} else {
							await LoadPropVariation(ped, component, prop);
							await takeScreenshotForComponent(pedType, type, component, prop, null, cameraSettings);
						}
					}
				}
			} else if (!isNaN(drawable)) {
				if (type === 'CLOTHING') {
					const textureVariationCount = GetNumberOfPedTextureVariations(ped, component, drawable);

					if (config.includeTextures) {
						for (let texture = 0; texture < textureVariationCount; texture++) {
							await LoadComponentVariation(ped, component, drawable, texture);
							await takeScreenshotForComponent(pedType, type, component, drawable, texture, cameraSettings);
						}
					} else {
						await LoadComponentVariation(ped, component, drawable);
						await takeScreenshotForComponent(pedType, type, component, drawable, null, cameraSettings);
					}
				} else if (type === 'PROPS') {
					const textureVariationCount = GetNumberOfPedPropTextureVariations(ped, component, prop);

					if (config.includeTextures) {
						for (let texture = 0; texture < textureVariationCount; texture++) {
							await LoadPropVariation(ped, component, prop, texture);
							await takeScreenshotForComponent(pedType, type, component, prop, texture, cameraSettings);
						}
					} else {
						await LoadPropVariation(ped, component, prop);
						await takeScreenshotForComponent(pedType, type, component, prop, null, cameraSettings);
					}
				}
			}
			SetPlayerControl(playerId, true);
			FreezeEntityPosition(ped, false);
			clearInterval(interval);
		}
	}
	SetPedOnGround();
	startWeatherResource();
	SendNUIMessage({
		end: true,
	});
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	stopHidingHud();
	camInfo = null;
	cam = null;
});

RegisterCommand('screenshotobject', async (source, args) => {
	let modelHash = isNaN(Number(args[0])) ? GetHashKey(args[0]) : Number(args[0]);
	const ped = GetPlayerPed(-1);

	if (IsWeaponValid(modelHash)) {
		modelHash = GetWeapontypeModel(modelHash);
	}

	if (!stopWeatherResource()) return;

	DisableIdleCamera(true);
	startHidingHud();


	await Delay(100);

	if (IsModelValid(modelHash)) {
		if (!HasModelLoaded(modelHash)) {
			RequestModel(modelHash);
			while (!HasModelLoaded(modelHash)) {
				await Delay(100);
			}
		}
	} else {
		console.log('ERROR: Invalid object model');
		return;
	}


	SetEntityCoords(ped, config.greenScreenHiddenSpot.x, config.greenScreenHiddenSpot.y, config.greenScreenHiddenSpot.z, false, false, false);

	SetPlayerControl(playerId, false);

	if (config.debug) console.log(`DEBUG: Spawning Object ${modelHash}`);

	const object = CreateObjectNoOffset(modelHash, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, true, true);

	SetEntityRotation(object, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);

	FreezeEntityPosition(object, true);

	await Delay(50);

	await takeScreenshotForObject(object, modelHash);


	DeleteEntity(object);
	SetPlayerControl(playerId, true);
	SetModelAsNoLongerNeeded(modelHash);
	startWeatherResource();
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	stopHidingHud();
	cam = null;
});

RegisterCommand('screenshotvehicle', async (source, args) => {
	const vehicles = (config.useQBVehicles && QBCore != null) ? Object.keys(QBCore.Shared.Vehicles) : GetAllVehicleModels();
	const ped = PlayerPedId();
	const type = args[0].toLowerCase();
	const primarycolor = args[1] ? parseInt(args[1]) : null;
	const secondarycolor = args[2] ? parseInt(args[2]) : null;

	screenshotState = 'running';
	if (!stopWeatherResource()) { screenshotState = 'idle'; return; }

	DisableIdleCamera(true);
	startHidingHud();
	SetEntityCoords(ped, config.greenScreenHiddenSpot.x, config.greenScreenHiddenSpot.y, config.greenScreenHiddenSpot.z, false, false, false);
	SetPlayerControl(playerId, false);

	ClearAreaOfVehicles(config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, 10, false, false, false, false, false);

	await Delay(100);

	if (type === 'all') {
		SendNUIMessage({
			start: true,
		});
		for (const vehicleModel of vehicles) {
			const vehicleHash = GetHashKey(vehicleModel);
			if (!IsModelValid(vehicleHash)) continue;


			const vehicleClass = GetVehicleClassFromName(vehicleHash);

			if (!config.includedVehicleClasses[vehicleClass]) {
				SetModelAsNoLongerNeeded(vehicleHash);
				continue;
			}

			SendNUIMessage({
				type: vehicleModel,
				value: vehicles.indexOf(vehicleModel) + 1,
				max: vehicles.length + 1
			});

			const vehicle = await createGreenScreenVehicle(vehicleHash, vehicleModel);

			if (vehicle === 0 || vehicle === null) {
				SetModelAsNoLongerNeeded(vehicleHash);
				console.log(`ERROR: Could not spawn vehicle. Broken Vehicle: ${vehicleModel}`);
				continue;
			}

			SetEntityRotation(vehicle, config.greenScreenVehicleRotation.x, config.greenScreenVehicleRotation.y, config.greenScreenVehicleRotation.z, 0, false);

			FreezeEntityPosition(vehicle, true);

			SetVehicleWindowTint(vehicle, 1);
			SetVehicleDirtLevel(vehicle, 0.0);
			WashDecalsFromVehicle(vehicle, 1.0);

			if (primarycolor) SetVehicleColours(vehicle, primarycolor, secondarycolor || primarycolor);

			await Delay(50);

			await takeScreenshotForVehicle(vehicle, vehicleHash, vehicleModel);

			DeleteEntity(vehicle);
			SetModelAsNoLongerNeeded(vehicleHash);

			if (!await waitIfPaused()) break;
		}
		const wasStopped = screenshotState === 'stopped';
		screenshotState = 'idle';
		SendNUIMessage(wasStopped ? { stopped: true } : { end: true });
	} else {
		const vehicleModel = type;
		const vehicleHash = GetHashKey(vehicleModel);
		if (IsModelValid(vehicleHash)) {



			SendNUIMessage({
				type: vehicleModel,
				value: vehicles.indexOf(vehicleModel) + 1,
				max: vehicles.length + 1
			});

			const vehicle = await createGreenScreenVehicle(vehicleHash, vehicleModel);

			if (vehicle === 0 || vehicle === null) {
				SetModelAsNoLongerNeeded(vehicleHash);
				console.log(`ERROR: Could not spawn vehicle. Broken Vehicle: ${vehicleModel}`);
				return;
			}

			SetEntityRotation(vehicle, config.greenScreenVehicleRotation.x, config.greenScreenVehicleRotation.y, config.greenScreenVehicleRotation.z, 0, false);

			FreezeEntityPosition(vehicle, true);

			SetVehicleWindowTint(vehicle, 1);
			SetVehicleDirtLevel(vehicle, 0.0);
			WashDecalsFromVehicle(vehicle, 1.0);

			if (primarycolor) SetVehicleColours(vehicle, primarycolor, secondarycolor || primarycolor);

			await Delay(50);

			await takeScreenshotForVehicle(vehicle, vehicleHash, vehicleModel);

			DeleteEntity(vehicle);
			SetModelAsNoLongerNeeded(vehicleHash);
		} else {
			console.log('ERROR: Invalid vehicle model');
		}
		screenshotState = 'idle';
	}
	SetPlayerControl(playerId, true);
	startWeatherResource();
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	stopHidingHud();
	cam = null;
});



RegisterCommand('screenshotweapons', async (source, args) => {
	const target = args[0]?.toLowerCase() ?? 'all';
	const weapons = target === 'all' ? config.weapons : [target];

	screenshotState = 'running';
	if (!stopWeatherResource()) { screenshotState = 'idle'; return; }

	DisableIdleCamera(true);
	startHidingHud();

	const localPed = GetPlayerPed(-1);
	SetEntityCoords(localPed, config.greenScreenHiddenSpot.x, config.greenScreenHiddenSpot.y, config.greenScreenHiddenSpot.z, false, false, false);
	SetPlayerControl(playerId, false);

	if (weapons.length > 1) SendNUIMessage({ start: true });

	await Delay(100);

	for (let i = 0; i < weapons.length; i++) {
		const weaponName = weapons[i];
		const weaponHash = GetHashKey(weaponName);

		if (!IsWeaponValid(weaponHash)) continue;

		const modelHash = GetWeapontypeModel(weaponHash);
		if (!IsModelValid(modelHash)) continue;

		if (weapons.length > 1) {
			SendNUIMessage({ type: weaponName, value: i + 1, max: weapons.length });
		}

		if (!HasModelLoaded(modelHash)) {
			RequestModel(modelHash);
			while (!HasModelLoaded(modelHash)) await Delay(100);
		}

		const rot = config.greenScreenWeaponRotation ?? config.greenScreenRotation;
		const object = CreateObjectNoOffset(modelHash, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, true, true);
		SetEntityRotation(object, rot.x, rot.y, rot.z, 0, false);
		FreezeEntityPosition(object, true);

		await Delay(50);
		await takeScreenshotForObject(object, modelHash, 'weapons', weaponName);

		DeleteEntity(object);
		SetModelAsNoLongerNeeded(modelHash);

		if (!await waitIfPaused()) break;
	}

	const wasStopped = screenshotState === 'stopped';
	screenshotState = 'idle';

	if (weapons.length > 1) SendNUIMessage(wasStopped ? { stopped: true } : { end: true });

	SetPlayerControl(playerId, true);
	startWeatherResource();
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	stopHidingHud();
	cam = null;
});

RegisterCommand('screenshotweaponcomponents', async (source, args) => {
	const target = args[0]?.toLowerCase() ?? 'all';
	const weaponComponents = config.weaponComponents ?? {};
	const weaponNames = target === 'all' ? Object.keys(weaponComponents) : [target];

	screenshotState = 'running';
	if (!stopWeatherResource()) { screenshotState = 'idle'; return; }

	DisableIdleCamera(true);
	startHidingHud();

	const modelHash = GetHashKey('mp_m_freemode_01');
	if (!HasModelLoaded(modelHash)) {
		RequestModel(modelHash);
		while (!HasModelLoaded(modelHash)) await Delay(100);
	}
	SetPlayerModel(playerId, modelHash);
	await Delay(200);
	SetModelAsNoLongerNeeded(modelHash);

	ped = PlayerPedId();
	SetEntityRotation(ped, config.greenScreenRotation.x, config.greenScreenRotation.y, config.greenScreenRotation.z, 0, false);
	SetEntityCoordsNoOffset(ped, config.greenScreenPosition.x, config.greenScreenPosition.y, config.greenScreenPosition.z, false, false, false);
	FreezeEntityPosition(ped, true);
	SetPlayerControl(playerId, false);

	await Delay(100);

	const total = weaponNames.reduce((acc, w) => acc + (weaponComponents[w]?.length ?? 0), 0);
	if (total > 0) SendNUIMessage({ start: true });

	let done = 0;

	for (const weaponName of weaponNames) {
		const components = weaponComponents[weaponName];
		if (!components || components.length === 0) continue;

		const weaponHash = GetHashKey(weaponName);
		if (!IsWeaponValid(weaponHash)) continue;

		for (const componentName of components) {
			RemoveAllPedWeapons(ped, true);
			await Delay(100);

			GiveWeaponToPed(ped, weaponHash, 999, false, true);
			GiveWeaponComponentToPed(ped, weaponHash, GetHashKey(componentName));
			SetCurrentPedWeapon(ped, weaponHash, true);

			const [pedX, pedY, pedZ] = GetEntityCoords(ped);
			const [fwdX, fwdY] = GetEntityForwardVector(ped);
			TaskAimGunAtCoord(ped, pedX + fwdX * 100, pedY + fwdY * 100, pedZ, -1, true, false);

			await Delay(1200);

			done++;
			SendNUIMessage({ type: `${weaponName} — ${componentName}`, value: done, max: total });

			await takeScreenshotForWeaponComponent(ped, weaponName, componentName);

			if (!await waitIfPaused()) break;
		}
		if (screenshotState === 'stopped') break;
	}

	const wasStopped = screenshotState === 'stopped';
	screenshotState = 'idle';

	RemoveAllPedWeapons(ped, true);
	FreezeEntityPosition(ped, false);
	SetPlayerControl(playerId, true);

	if (total > 0) SendNUIMessage(wasStopped ? { stopped: true } : { end: true });

	startWeatherResource();
	DestroyAllCams(true);
	DestroyCam(cam, true);
	RenderScriptCams(false, false, 0, true, false, 0);
	stopHidingHud();
	cam = null;
});

setImmediate(() => {
	emit('chat:addSuggestions', [
		{
			name: '/greenscreener',
			help: 'ouvrir l\'interface WebUI du greenscreener',
		},
		{
			name: '/screenshot',
			help: 'generate clothing screenshots',
		},
		{
			name: '/customscreenshot',
			help: 'generate custom cloting screenshots',
			params: [
				{name:"component", help:"The clothing component to take a screenshot of"},
				{name:"drawable/all", help:"The drawable variation to take a screenshot of"},
				{name:"props/clothing", help:"PROPS or CLOTHING"},
				{name:"male/female/both", help:"The gender to take a screenshot of"},
				{name:"camera settings", help:"The camera settings to use for the screenshot (optional)"},
			]
		},
		{
			name: '/screenshotobject',
			help: 'generate object screenshots',
			params: [
				{name:"object", help:"The object hash to take a screenshot of"},
			]
		},
		{
			name: '/screenshotvehicle',
			help: 'generate vehicle screenshots',
			params: [
				{name:"model/all", help:"The vehicle model or 'all' to take a screenshot of all vehicles"},
				{name:"primarycolor", help:"The primary vehicle color to take a screenshot of (optional) See: https://wiki.rage.mp/index.php?title=Vehicle_Colors"},
				{name:"secondarycolor", help:"The secondary vehicle color to take a screenshot of (optional) See: https://wiki.rage.mp/index.php?title=Vehicle_Colors"},
			]
		},
		{
			name: '/screenshotweapons',
			help: 'generate weapon prop screenshots (saved to images/weapons/)',
			params: [
				{name:"weapon/all", help:"Weapon name (e.g. weapon_pistol) or 'all' for every weapon in config"},
			]
		},
		{
			name: '/screenshotweaponcomponents',
			help: 'generate weapon+component screenshots, ped holding each accessory (saved to images/weapon_components/)',
			params: [
				{name:"weapon/all", help:"Weapon name or 'all' for every weapon with components in config"},
			]
		}
	])
  });

// ── Web UI ──────────────────────────────────────────────────────────────────

RegisterCommand('greenscreener', () => {
	SetNuiFocus(true, true);
	SendNUIMessage({
		uiAction: 'open',
		resourceName: GetCurrentResourceName(),
		weapons: config.weapons ?? [],
		weaponComponents: Object.keys(config.weaponComponents ?? {}),
	});
}, false);

RegisterNuiCallback('closeUI', (data, cb) => {
	SetNuiFocus(false, false);
	cb({});
});

RegisterNuiCallback('reopenUI', (data, cb) => {
	SetNuiFocus(true, true);
	cb({});
});

RegisterNuiCallback('releaseUI', (data, cb) => {
	SetNuiFocus(false, false);
	cb({});
});

RegisterNuiCallback('pauseScreenshots', (data, cb) => {
	if (screenshotState === 'running') screenshotState = 'paused';
	cb({});
});

RegisterNuiCallback('resumeScreenshots', (data, cb) => {
	if (screenshotState === 'paused') screenshotState = 'running';
	cb({});
});

RegisterNuiCallback('stopScreenshots', (data, cb) => {
	screenshotState = 'stopped';
	cb({});
});

RegisterNuiCallback('startScreenshots', (data, cb) => {
	cb({});
	screenshotState = 'running';
	// NUI focus reste actif : la souris est capturée par le widget de progression

	switch (data.category) {
		case 'clothing':
			if (data.mode === 'all') {
				const gArg = data.gender && data.gender !== 'both' ? data.gender : '';
				ExecuteCommand(('screenshot ' + gArg).trim());
			} else {
				const comp  = data.component ?? '1';
				const draw  = data.drawable   ?? 'all';
				const ctype = data.clothingType ?? 'clothing';
				const gen   = data.gender ?? 'both';
				ExecuteCommand(`customscreenshot ${comp} ${draw} ${ctype} ${gen}`);
			}
			break;
		case 'vehicles': {
			const model = (data.mode === 'specific' && data.model) ? data.model : 'all';
			const parts = [model];
			if (data.color1 !== undefined && data.color1 !== '') parts.push(data.color1);
			if (data.color2 !== undefined && data.color2 !== '') parts.push(data.color2);
			ExecuteCommand(`screenshotvehicle ${parts.join(' ')}`);
			break;
		}
		case 'weapons':
			ExecuteCommand(`screenshotweapons ${(data.mode === 'specific' && data.weapon) ? data.weapon : 'all'}`);
			break;
		case 'weaponComponents':
			ExecuteCommand(`screenshotweaponcomponents ${(data.mode === 'specific' && data.weapon) ? data.weapon : 'all'}`);
			break;
		case 'objects':
			if (data.hash) ExecuteCommand(`screenshotobject ${data.hash}`);
			break;
	}
});

on('onResourceStop', (resName) => {
	if (GetCurrentResourceName() != resName) return;

	startWeatherResource();
	stopHidingHud();
	clearInterval(interval);
	SetPlayerControl(playerId, true);
	FreezeEntityPosition(ped, false);
});
