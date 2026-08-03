/* =========================================================================
   antep — Script principal
   - Bascule de langue FR / EN (attributs data-fr / data-en)
   - État de la barre de navigation au scroll
   - Menu burger (mobile)
   - Filtres de projets par catégorie
   - Apparition des éléments au scroll (IntersectionObserver)
   IIFE : tout est encapsulé pour ne pas polluer le scope global.
   ========================================================================= */

(function(){
  var lang = 'fr'; // langue courante ('fr' par défaut)

  // Applique une langue : remplace le contenu des éléments porteurs de
  // data-fr / data-en, puis met à jour l'état visuel du sélecteur FR/EN.
  function applyLang(l){
    lang = l;
    document.documentElement.lang = l;
    document.querySelectorAll('[data-fr]').forEach(function(el){
      var val = el.getAttribute('data-'+l);
      if(val !== null) el.innerHTML = val;
    });
    document.querySelectorAll('.lang-toggle button').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-setlang')===l);
    });
  }

  document.querySelectorAll('.lang-toggle button').forEach(function(b){
    b.addEventListener('click', function(){ applyLang(b.getAttribute('data-setlang')); });
  });

  // Barre de navigation : ajoute une bordure une fois la page défilée
  var nav = document.getElementById('nav');
  window.addEventListener('scroll', function(){
    nav.classList.toggle('scrolled', window.scrollY > 20);
  });

  // Menu burger (mobile) : ouverture / fermeture du panneau
  var burger = document.getElementById('burger');
  var navLinks = document.getElementById('navLinks');
  burger.addEventListener('click', function(){
    burger.classList.toggle('x');
    navLinks.classList.toggle('open');
  });
  navLinks.querySelectorAll('a').forEach(function(a){
    a.addEventListener('click', function(){
      burger.classList.remove('x'); navLinks.classList.remove('open');
    });
  });

  // Filtres de projets : affiche / masque les cartes selon la catégorie
  var filterBtns = document.querySelectorAll('.filter-btn');
  var cards = document.querySelectorAll('#projGrid .proj-card');
  filterBtns.forEach(function(btn){
    btn.addEventListener('click', function(){
      filterBtns.forEach(function(b){b.classList.remove('active');});
      btn.classList.add('active');
      var f = btn.getAttribute('data-filter');
      cards.forEach(function(c){
        var show = f==='all' || c.getAttribute('data-cat').indexOf(f)>-1;
        c.style.display = show ? 'flex' : 'none';
      });
    });
  });

  // Apparition au scroll : révèle les .reveal quand ils entrent dans le viewport
  var io = new IntersectionObserver(function(entries){
    entries.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('in'); io.unobserve(e.target);} });
  }, {threshold:0.12});
  document.querySelectorAll('.reveal').forEach(function(el){ io.observe(el); });

  // Année courante dans le pied de page
  document.getElementById('year').textContent = new Date().getFullYear();

  applyLang('fr'); // initialisation en français
})();
