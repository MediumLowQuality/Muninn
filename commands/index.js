module.exports = {
	MunSet: require('./serverSettings'),
	MunCheck: require('./checkAccess'),
	ListCommands: require('./listCommands'),
	MunKill: require('./kill'),
	MunBoot: require('./reboot'),
	/*MunArch: require('./selfArchive'), discontinued for now due to size*/
	MunClean: require('./spamCleanup'),
	MunScript: require('./runScripts'),
	FactLookup: require('./factLookup'),
	FactDef: require('./factDef'),
	/*SpitFax: require('./discordObjectDefine'), why does this exist*/
	/*Raffle: require('./raffle'), temporarily discontinued*/
	/*NotABug: require('./notABug'), discontinued*/
	/*DontPingSimon: require('./dontPingSimon'), discontinued*/
	
};
