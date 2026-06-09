import React from 'react'; // React is not directly used in this component, but it's a common practice to import it.

function Portfolio({ home }) {
  // Проверка на существование данных и резервный заголовок
  const title = home?.portfolio?.title || "Мое Портфолио";
  const subtitle = home?.portfolio?.subtitle || "Здесь представлены наши лучшие работы.";

  return (
    <div className="portfolio">
      <h1>{title}</h1>
      <p className="section-subtitle">{subtitle}</p>
      <div className="gallery-container">
        {/* Здесь будут элементы портфолио */}
      </div>
      <button className="btn btn-primary">Посмотреть все работы</button>
    </div>
  )
  )
}

export default Portfolio;
