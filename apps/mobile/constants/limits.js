/**
 * Free-tier inventory cap. Counts rows in the `cavaro` collection, so topping up
 * the quantity of a cigar already stored does not count against it.
 * Enforced on the Add Cigar screen and by Taste Profile quick-add.
 */
export const FREE_CIGAR_LIMIT = 5;
