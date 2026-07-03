const { allLocales } = require('@faker-js/faker');
const { faker } = require('@faker-js/faker/locale/en');

function createUser(sex) {
    const firstName = faker.person.firstName(sex);
    const lastName = faker.person.lastName();

    const email = faker.internet.email({ firstName, lastName, provider: 'email.com' }).toLowerCase();

    return {
        firstName,
        lastName,
        email: email,
        phone: faker.phone.number({ style: 'international' }),
        password: faker.internet.password({
            length: 12,
            prefix: '!1Aa',
        }),
        dateOfBirth: faker.date
            .past({
                years: 20,
            })
            .toISOString()
            .substring(0, 10),
    };
}

const randomLocale = faker.helpers.arrayElement(Object.keys(allLocales));

console.log('Random locale:', randomLocale);

// fake timezone
console.log(createUser(faker.person.sex()));
