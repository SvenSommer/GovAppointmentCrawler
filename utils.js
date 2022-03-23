function now() {
	const date = new Date();
	return new Intl.DateTimeFormat('en-DE', { dateStyle: 'full', timeStyle: 'long' }).format(date);
};
function normalize(string){
	return string.replace(/\s|:|\.|\-|,/gi, "_")
}
module.exports = {
	now,
	normalize
}