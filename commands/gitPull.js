const git = require('simple-git')().init();
const fs = require('fs');

const move = (fromPath, toPath, file) => fs.promises.copyFile(`${fromPath}/${file.name}`, `${toPath}/${file.name}`)
	.then(() => fs.promises.unlink(`${fromPath}/${file.name}`));

async function cloneDirectory(fromPath, toPath){
	if(!fs.existsSync(toPath)) fs.mkdirSync(toPath);
	let contents = await fs.promises.readdir(fromPath, {withFileTypes: true});
	let files = await contents.filter(file => file.isFile()), dirs = await contents.filter(dir => dir.isDirectory());
	let filesPromise = Promise.all(await files.map(file => 
		fs.promises.access(`${toPath}/${file.name}`, fs.constants.W_OK)
		.then(() => move(fromPath, toPath, file))
		.catch((e) => {
			if(!fs.existsSync(`${toPath}/${file.name}`)) return move(fromPath, toPath, file);
			console.log(`${file.name} cannot be written to. Deleting.`);
			return fs.promises.unlink(`${toPath}/${file.name}`).then(() => move(fromPath, toPath, file));
		})
	));
	if(dirs.length > 0) {
		let dirsPromise = Promise.all(await dirs.map(dir => cloneDirectory(`${fromPath}/${dir.name}`, `${toPath}/${dir.name}`)));
		return Promise.all([filesPromise, dirsPromise]).then(() => fs.promises.rmdir(`${fromPath}`));
	}
	return filesPromise.then(() => fs.promises.rmdir(`${fromPath}`));
}

module.exports = {
	clone() {
		let dirName = __dirname.replace(/\\/g, '/');
		dirName = dirName.substring(0, dirName.lastIndexOf('/'));
		return git.clone('https://github.com/MediumLowQuality/Muninn', 'repo')
		.then(() => cloneDirectory('repo', dirName))
		.then(() => Promise.all(['commands/_facts.txt', 'commands/_settings.txt'].map(path => fs.promises.unlink(path))))
		.catch((e) => console.log('Clone failed. '+e));
	}
};