// The org's shared "ask HR/IT" login isn't a real inbox — it just needs to be
// unique per org (User.email has a unique index) and never collide with a
// real person's email a company might also register. Keyed by companyCode
// (guaranteed unique, unlike a name-derived slug).
export function employeeAccountEmail(companyCode) {
    return `employee-access+${companyCode}@docyra.internal`;
}
