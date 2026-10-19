# Project rules

## Testing

- **Every change ships with tests.** When adding a feature, refactoring existing behaviour, or handling an edge case, add or update tests so the new and changed behaviour is fully covered — server routes as well as frontend components, hooks and utilities.
- **Test data is synthetic and untraceable.** Use invented, anonymised values for names, schools, addresses, emails, IBANs, ids, dates and prices. Never copy a value seen in the live database or in real documents into a test, fixture, comment or commit.
