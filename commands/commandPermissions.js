const groups = require('./serverSettings').groups;

function commandAllowedInChannel(command, server, channel){
	let {allowedChannels} = command;
	if(allowedChannels === undefined) return true;
	channel = channel.toLowerCase();
	if(typeof allowedChannels === 'string') return allowedChannels.toLowerCase() === channel;
	if(Array.isArray(allowedChannels)) return allowedChannels.includes(channel);
	if(typeof allowedChannels === 'function') return allowedChannels(server, channel);
	return false;
}

function commandAllowedByUser(command, user, args, msg){
	if(process.isAdmin(user)) return true;
	let {allowedUsers} = command;
	if(allowedUsers === undefined) return true;
	if(typeof allowedUsers === 'string') return allowedUsers === user;
	if(Array.isArray(allowedUsers)) return allowedUsers.includes(user);
	if(typeof allowedUsers === 'function') return allowedUsers(args, msg, groups);
	return false;
}

module.exports = {
	commandAllowedInChannel,
	commandAllowedByUser
};