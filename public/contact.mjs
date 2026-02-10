function isValidEmail(stringToTest) {
  const emailRegex = /^(?!\.)(?!.*\.\.)([a-z0-9_'+\-\.]*)[a-z0-9_'+\-]@([a-z0-9][a-z0-9\-]*\.)+[a-z]{2,}$/i;
  return emailRegex.test(stringToTest);
}

const form = document.querySelector('.contact-form');

const emailError = document.createElement('p');
emailError.id = 'email-error';
emailError.className = 'error-message';
document.querySelector('#email').after(emailError);

const checkboxError = document.createElement('p');
checkboxError.id = 'checkbox-error';
checkboxError.className = 'error-message';
document.querySelector('fieldset').after(checkboxError);

form.addEventListener('submit', (event) => {

  const emailInput = document.querySelector('#email');
  const checkboxes = document.querySelectorAll('input[name="role"]');
  let firstInvalid = null;

  if (!isValidEmail(emailInput.value)) {
    emailInput.setAttribute('aria-invalid', 'true');
    emailInput.setAttribute('aria-describedby', 'email-error');
    emailError.innerText = 'Please enter a valid email address.';
    if (!firstInvalid) firstInvalid = emailInput;
  } else {
    emailInput.removeAttribute('aria-invalid');
    emailInput.removeAttribute('aria-describedby');
    emailError.innerText = '';
  }

  let atLeastOneChecked = false;
  checkboxes.forEach((checkbox) => {
    if (checkbox.checked) atLeastOneChecked = true;
  });

  if (!atLeastOneChecked) {
    checkboxes.forEach((checkbox) => {
      checkbox.setAttribute('aria-invalid', 'true');
      checkbox.setAttribute('aria-describedby', 'checkbox-error');
    });
    checkboxError.innerText = 'Please select at least one option.';
    if (!firstInvalid) firstInvalid = checkboxes[0];
  } else {
    checkboxes.forEach((checkbox) => {
      checkbox.removeAttribute('aria-invalid');
      checkbox.removeAttribute('aria-describedby');
    });
    checkboxError.innerText = '';
  }

  if (firstInvalid) {
    event.preventDefault();
    firstInvalid.focus();
  }
});