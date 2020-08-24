require('dotenv').config();
const util = require('util');
const Discord = require('discord.js');
const bot = new Discord.Client();
bot.commands = new Discord.Collection();
const botCommands = require('./commands');
let commandAliases = [];

Object.keys(botCommands).map(key => {
	bot.commands.set(botCommands[key].name, botCommands[key]);
	if(botCommands[key].alias !== undefined) commandAliases.push(botCommands[key].alias);
});

const TOKEN = process.env.TOKEN;
const ADMIN = process.env.ADMIN;
const AUXADMIN = process.env.AUXADMIN;
const BOT = process.env.BOT;
const baseServer = '718870504772993045';
const munLog = '746741263130165338';
const groups = bot.commands.get('munset').groups;
process.bot = bot;
process.isAdmin = (id) => (id === process.env.ADMIN || id === process.env.AUXADMIN);


bot.login(TOKEN);

bot.on('ready', () => {
	console.info(`Logged in as ${bot.user.tag}!`);
	const logChannel = bot.guilds.get(baseServer).channels.get(munLog);
	process.log = (str) => logChannel.send(typeof str === 'string'? str: util.format(str))
	.catch(error => console.log(`${str} failed to send.\r\n${error}`));
});

bot.on('message', msg => {
	const chan = msg.channel.name;
	const author = msg.author.id;
	if(author === bot.user.id) return;
	if(!msg.content || msg.content === "") return;
	let args = msg.content.trim()//message body, removing extra spaces and such
		.split(/"/).map(s => s.trim())//split around quotes, such that phrases in quotes are in odd indices
		.map((chunk, index) => index % 2 === 0? chunk.split(/ +/): chunk)//return quoted phrases as is, split others around spaces
		.flat().filter(s => s !== "");//condense nested arrays to one array and remove empty strings
	let command = args.shift().toLowerCase();
	
	//some messages can trigger the bot to run a command in non-standard ways
	[command, args] = commandAliases.reduce((commandArgs, alias) => alias(...commandArgs), [command, args, msg]);
	
	if (!bot.commands.has(command)) return;
	let botCommand = bot.commands.get(command);
	// for commands that need access to other commands
	if (botCommand.metacommand) args.unshift(bot.commands);
	//whitelists
	if (botCommand.allowedChannels !== undefined && !botCommand.allowedChannels.includes(chan) && chan !== 'console'){
		return;
	}
	if (botCommand.allowedUsers !== undefined && author !== ADMIN && author !== AUXADMIN){
		let allowedUsers = botCommand.allowedUsers;
		if(Array.isArray(allowedUsers) && !allowedUsers.includes(author)){
			return;
		}
		if(typeof allowedUsers === 'function' && !allowedUsers(args, msg, groups)){
			return;
		}
	}
	process.log(`${msg.author.tag} called command: ${command}${args.length > 0? ' with args ' + args:''}`);
	//cooldown handling
	if(botCommand.cooldown !== undefined) {
		let now = Date.now();
		if(botCommand.lastCall !== undefined && author !== ADMIN){
			let timeSinceLastCall = now - botCommand.lastCall;
			if(timeSinceLastCall < botCommand.cooldown){
				let timeLeft = (botCommand.cooldown - timeSinceLastCall)/1000.0;
				if(timeLeft > 1.0) msg.channel.send(`That command is on cooldown for ${timeLeft.toFixed(1)} seconds.`);
				return;
			}
		} else {
			botCommand.lastCall = now;
		}
	}

	try {
		botCommand.execute(msg, args);
	} catch (error) {
		console.error(error);
		msg.reply(`Error: ${error}`);
	}
});

/*[ commands with allowedUsers rewrites that need to be tested
  'munset',
  'munkill',
  'munboot',
  'munarch',
  'munclean',
  'raffle',
  'dontpingsimon'
]*/