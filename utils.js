function now() {
	const date = new Date();
	return new Intl.DateTimeFormat('en-DE', { dateStyle: 'full', timeStyle: 'long' }).format(date);
};
module.exports = {
	now
}