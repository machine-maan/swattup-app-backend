const crowdSeeder = require("../seeder/crowdSeeder");

async function seeder() {
    crowdSeeder();
}

module.exports = () => {
    seeder();
}