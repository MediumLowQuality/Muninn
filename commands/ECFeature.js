const fs = require('fs');
const {readFileSync, existsSync} = fs;
let features = {};
let activeKey = null;
let activeFeature = null;

if(existsSync(`${__dirname}/facts/features.json`)){
	try{
		let file = readFileSync(`${__dirname}/facts/features.json`);
		features = JSON.parse(file);
	} catch(e) {console.log(e); features = {};}
}
function article({description, quote, places, people, enemies}) {
	let placesColor = '#3598db';
	let peopleColor = '#2dc26b';
	let enemiesColor = '#e03e2d';
	let htmlParts = [];
	if(description){
		let descParagraphs = description.split('\n').map(p => p.trim()).filter(p => p.length);
		let htmlDesc = descParagraphs.map(p => `<p>${p}</p>`).join('\n');
		htmlParts.push(htmlDesc);
		let spacer = '<p>&nbsp;</p>\n<hr />';
		htmlParts.push(spacer);
	}
	if(quote){
		let htmlQuote = `<p style="text-align: center;"><span style="color: #95a5a6;"><em>"${quote}"</em></span></p>`;
		htmlParts.push(htmlQuote);
		let spacer = '<hr />\n<p>&nbsp;</p>';
		htmlParts.push(spacer);
	}
	if(places){
		let placesTitle = `<h4><span style="color: ${placesColor};">Places to Go</span></h4>`;
		htmlParts.push(placesTitle);
		htmlParts.push(`<p>${places}</p>`);
	}
	if(people){
		let peopleTitle = `<h4><span style="color: ${peopleColor};">People to See</span></h4>`;
		htmlParts.push(peopleTitle);
		htmlParts.push(`<p>${people}</p>`);
	}
	if(enemies){
		let enemiesTitle = `<h4><span style="color: ${enemiesColor};">Enemies to Fight</span></h4>`;
		htmlParts.push(enemiesTitle);
		htmlParts.push(`<p>${enemies}</p>`);
	}
	if(htmlParts.length > 0){
		let disclaimer = '<p>&nbsp;</p>\n<p><span style="color: #95a5a6;"><em>All Quest Features are subject to change.</em></span></p>';
		htmlParts.push(disclaimer);
	}
	let html = htmlParts.join('\n')
	return html;
}

const featureProps = ['description', 'quote', 'places', 'people', 'enemies'];
const backtickWrap = (s) => '`' + s + '`';

function featureToMessage(feature){
	if(Object.keys(feature).length === 0) return `There is no data on this feature yet.`;
	return featureProps.filter(key => key in feature).map(key => `${backtickWrap(key)}: ${feature[key]}`).join('\r\n');
}

module.exports = {
	name: 'qfeature',
	description: 'Utility for EC Quest Features',
	allowedChannels: ['console'],
	allowedUsers: (args, msg, groups) => process.isAdmin(msg.author.id) || msg.author.id === '156585316600381440',
	execute(msg, args) {
		const origChannel = msg.channel;
		const server = origChannel.guild;
		if(!server.available) return;
		if(args.length === 0){
			let message = [
				'Use `qfeature start <name>` to start editing a feature, and `qfeature stop` to stop editing.',
				'Use `qfeature list` to list features by name.',
				'Use `qfeature set` to add data to the active feature, and `qfeature get` to view feature data.',
				'Use `qfeature post` to get the active feature\'s formatted html.',
				'Use `qfeature delete <name>` to delete a feature.',
				'Use `qfeature save` to save features for later use.'
			].join(' ');
			return origChannel.send(message);
		}
		let op = args.shift().toLowerCase();
		if(op === 'start'){
			if(args.length === 0) return origChannel.send('You must include a name for the feature.');
			let key = args.join(' ').toLowerCase();
			if(key in features){
				activeKey = key;
				activeFeature = features[key];
				return origChannel.send(`Selected feature "${key}".`);
			} else {
				features[key] = {};
				activeKey = key;
				activeFeature = features[key];
				return origChannel.send(`Started new feature "${key}".`);
			}
		}
		if(op === 'stop'){
			activeKey = null;
			activeFeature = null;
			return origChannel.send(`Stopped feature editing.`);
		}
		if(op === 'list'){
			let keys = Object.keys(features);
			if(keys.length === 0) return origChannel.send('No features exist.');
			let message = 'These features exist:\r\n' + keys.map(k => '`' + k + '`').join('\r\n');
			return origChannel.send(message);
		}
		if(op === 'get'){
			let key = args.length > 0? args[0]: '';
			let otherKey = args.join(' ');
			let feature = features[otherKey] ?? features[key] ?? activeFeature;
			if(!feature) return origChannel.send('No feature specified.');
			return origChannel.send(featureToMessage(feature));
		}
		if(op === 'set'){
			if(activeFeature){
				if(args.length === 0) return origChannel.send(`You must set one of these properties: ${featureProps.join(', ')}.`);
				let prop = args.shift().toLowerCase();
				if(featureProps.includes(prop)){
					if(args.length === 0) return origChannel.send(`You must include a new value.`);
					activeFeature[prop] = args.join(' ');
					return origChannel.send(`Set "${activeKey}" ${prop}: "${activeFeature[prop]}".`);
				} else return origChannel.send(`You must set one of these properties: ${featureProps.join(', ')}.`);
			} else return origChannel.send('No feature active for editing. Use `qfeature start <name>` to pick an active feature.');
		}
		if(op === 'post'){
			if(activeFeature){
				let message = '```html\r\n' + article(activeFeature) + '\r\n```';
				return origChannel.send(message);
			} else return origChannel.send('No feature active for editing. Use `qfeature start <name>` to pick an active feature.');
		}
		if(op === 'delete'){
			if(args.length === 0) return origChannel.send('No feature specified.');
			let key = args.shift().toLowerCase();
			if(key in features){
				delete features[key];
				return origChannel.send(`Feature ${key} deleted.`);
			} else return origChannel.send(`Feature ${key} not found.`);
		}
		if(op === 'save'){
			return fs.promises.writeFile(`${__dirname}/facts/features.json`, JSON.stringify(features, null, '\t'), 'utf8')
				.then(() => origChannel.send(`Features saved.`));
		}
	}
};