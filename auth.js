(function () {
  if (!sessionStorage.getItem('auth')) {
    const here = encodeURIComponent(location.pathname + location.search);
    location.replace('/login.html?r=' + here);
  }
})();
