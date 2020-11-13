export default function parseRequiredChecks(input) {
  return input ? input.split(',') : [];
}
