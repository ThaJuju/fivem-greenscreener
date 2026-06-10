fx_version 'cerulean'
game 'gta5'

author 'Juju'
--author 'Ben' -- not working with screenshot-basic, needs to be fixed
description 'fivem-greenscreener'
version '1.6.6'

this_is_a_map 'yes'

ui_page 'html/index.html'


files {
    'config.json',
    'html/*'
}

client_script 'client.js'

server_script 'server.js'

dependencies {
	'screenshot-basic',
    'yarn'
}
