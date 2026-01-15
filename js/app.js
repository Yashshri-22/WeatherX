const centerTextPlugin = {
  id: "centerText",
  afterDraw(chart) {
    if (!chart.config.options.centerText) return;

    const { ctx, chartArea } = chart;
    const text = chart.config.options.centerText;

    ctx.save();
    ctx.font = "bold 18px Segoe UI";
    ctx.fillStyle = "#111827";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(
      text,
      (chartArea.left + chartArea.right) / 2,
      (chartArea.top + chartArea.bottom) / 2
    );
    ctx.restore();
  },
};

Chart.register(centerTextPlugin);

// ==============================
// CONFIG
// ==============================
const API_KEY = "aaf88369a514091c65d0ee969c7a6fb1";
const DEFAULT_CITY = "Pune";

// WEATHER LAYERS
let cloudLayer;
let rainLayer;

// Map Instances
let map;
let marker;

// Chart instances
let hourlyChart = null;
let weeklyChart = null;

// Insight charts
let rainDonutChart = null;
let tempComfortChart = null;
let humidityGaugeChart = null;
let lastInsightText = "";

let isPanelOpen = false;

// ==============================
// INIT (ONLY ONE DOMContentLoaded)
// ==============================
document.addEventListener("DOMContentLoaded", () => {
  const searchBtn = document.getElementById("searchBtn");
  const searchInput = document.getElementById("searchInput");

  if (!searchBtn || !searchInput) {
    console.error("Search elements missing");
    return;
  }

  // 🔍 Search handlers
  searchBtn.addEventListener("click", () => {
    const city = searchInput.value.trim();
    if (city) fetchWeather(city);
  });

  searchInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const city = searchInput.value.trim();
      if (city) fetchWeather(city);
    }
  });

  document.querySelectorAll(".small-card").forEach((card) => {
    observer.observe(card);
  });

  // USE CURRENT LOCATION FIRST
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        fetchWeatherByCoords(latitude, longitude);
      },
      () => {
        // Permission denied → fallback
        fetchWeather(DEFAULT_CITY);
      }
    );
  } else {
    fetchWeather(DEFAULT_CITY);
  }
});

// ==============================
// MAIN FETCH
// ==============================
async function fetchWeather(city) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?q=${city}&units=metric&appid=${API_KEY}`
    );
    const data = await res.json();

    if (data.cod !== "200") throw new Error(data.message);
    window.lastWeatherData = data;

    updateHero(data);
    updateTodayCards(data);
    updateRightPanel(data);
    updateCharts(data);
    initMap(data.city.coord.lat, data.city.coord.lon);
    togglePanel(true);
  } catch (err) {
    alert("City not found");
    console.error(err);
  }
}

function showForecastUnavailable(days) {
  const container = document.getElementById("forecastList");

  container.innerHTML = `
    <div style="
      text-align:center;
      padding:20px;
      font-size:14px;
      color:#cbd5f5;
    ">
      📅 ${days}-day forecast is not available<br/>
      with the current weather data source.
      <br/><br/>
      <small>Coming soon 🌤️</small>
    </div>
  `;
}


async function fetchWeatherByCoords(lat, lon) {
  try {
    const res = await fetch(
      `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&units=metric&appid=${API_KEY}`
    );
    const data = await res.json();

    if (data.cod !== "200") throw new Error(data.message);

    updateHero(data);
    updateTodayCards(data);
    updateRightPanel(data);
    updateCharts(data);
    initMap(lat, lon);
  } catch (err) {
    console.error(err);
    fetchWeather(DEFAULT_CITY);
  }
}

// ==============================
// HERO
// ==============================
function updateHero(data) {
  const now = new Date();

  // ⏰ Time
  document.getElementById("time").innerText = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });

  // 📅 Date
  document.getElementById("date").innerText = now.toLocaleDateString(
    undefined,
    {
      weekday: "long",
      month: "long",
      day: "numeric",
    }
  );

  // 🌅 Greeting (NEW)
  document.getElementById("greeting").innerText = getGreetingByTime(now);

  const weatherMain = data.list[0].weather[0].main;
  const weatherIcon = data.list[0].weather[0].icon;

  document.getElementById("heroCondition").innerText = weatherMain;

  // 🎨 Background
  const pop = data.list[0].pop || 0;
  updateHeroBackground(weatherMain, weatherIcon, pop);

  // 📍 City
  document.getElementById("cityName").innerHTML = `
  <i class="bi bi-geo-alt-fill"></i>
  <span>${data.city.name}, ${data.city.country}</span>
`;
}

// ==============================
// TODAY CARDS
// ==============================
function updateTodayCards(data) {
  const current = data.list[0];

  document.getElementById("tempCard").innerHTML = `${Math.round(
    current.main.temp
  )}°C`;

  document.getElementById(
    "humidityCard"
  ).innerHTML = `${current.main.humidity}%`;

  document.getElementById("windCard").innerHTML = `${Math.round(
    current.wind.speed
  )} km/h`;

  document.getElementById("rainCard").innerHTML = `${Math.round(
    (current.pop || 0) * 100
  )}%`;
}

// ==============================
// RIGHT PANEL
// ==============================
function updateRightPanel(data) {
  const current = data.list[0];

  document.getElementById("rightTemp").innerText = `${Math.round(
    current.main.temp
  )}°C`;

  document.getElementById("rightCondition").innerText = current.weather[0].main;

  document.getElementById("rightWind").innerText = `${Math.round(
    current.wind.speed
  )} km/h`;

  document.getElementById(
    "rightHumidity"
  ).innerText = `${current.main.humidity}%`;

  document.getElementById(
    "weatherIcon"
  ).src = `https://openweathermap.org/img/wn/${current.weather[0].icon}@2x.png`;

  updateForecast(data);
}

document.addEventListener("click", (e) => {
  const panel = document.getElementById("rightPanel");
  const arrow = document.querySelector(".toggle-arrow");

  if (
    isPanelOpen &&
    !panel.contains(e.target) &&
    !arrow.contains(e.target)
  ) {
    togglePanel(false);
  }
});

document.querySelectorAll(".tab").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach((b) =>
      b.classList.remove("active")
    );
    btn.classList.add("active");

    const range = btn.dataset.range;
    handleForecastRange(range);
  });
});

function handleForecastRange(range) {
  if (!window.lastWeatherData) return;

  if (range === "4") {
    updateForecast(window.lastWeatherData);
  } else {
    showForecastUnavailable(range);
  }
}

// ==============================
// CHARTS
// ==============================
function updateCharts(data) {
  updateHourlyChart(data);
  updateWeeklyChart(data);

  // Insight charts
  updateRainDonut(data);
  updateTempComfortChart(data);
  updateHumidityGauge(data);
  updateComfortAI(data);
}

// ==============================
// HOURLY TEMP
// ==============================
function updateHourlyChart(data) {
  const ctx = document.getElementById("hourlyTemp");
  if (!ctx) return;

  if (hourlyChart) hourlyChart.destroy();

  hourlyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: data.list
        .slice(0, 8)
        .map((h) => new Date(h.dt * 1000).getHours() + ":00"),
      datasets: [
        {
          data: data.list.slice(0, 8).map((h) => h.main.temp),
          borderColor: "#2563eb",
          backgroundColor: "rgba(37,99,235,0.2)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: {
      plugins: {
        legend: { display: false },
      },
    },
  });
}

// ==============================
// WEEKLY TEMP
// ==============================
function updateWeeklyChart(data) {
  const ctx = document.getElementById("weeklyTemp");
  const daily = {};
  if (!ctx) return;

  data.list.forEach((item) => {
    const day = new Date(item.dt * 1000).toLocaleDateString(undefined, {
      weekday: "short",
    });
    daily[day] = daily[day] || [];
    daily[day].push(item.main.temp);
  });

  if (weeklyChart) weeklyChart.destroy();

  weeklyChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Object.keys(daily),
      datasets: [
        {
          data: Object.values(daily).map(
            (arr) => arr.reduce((a, b) => a + b) / arr.length
          ),
          borderColor: "#10b981",
          backgroundColor: "rgba(16,185,129,0.2)",
          fill: true,
          tension: 0.4,
        },
      ],
    },
    options: { plugins: { legend: { display: false } } },
  });
}

// ==============================
// PANEL TOGGLE
// ==============================
function togglePanel(forceState = null) {
  const app = document.getElementById("app");

  if (forceState === true) {
    app.classList.add("panel-open");
    isPanelOpen = true;
  } else if (forceState === false) {
    app.classList.remove("panel-open");
    isPanelOpen = false;
  } else {
    app.classList.toggle("panel-open");
    isPanelOpen = app.classList.contains("panel-open");
  }

  handleMapInteraction();
}

function updateForecast(data) {
  const container = document.getElementById("forecastList");
  container.innerHTML = "";

  const daily = {};

  data.list.forEach((item) => {
    const day = new Date(item.dt * 1000).toLocaleDateString(undefined, {
      weekday: "short",
    });
    if (!daily[day]) daily[day] = item;
  });

  Object.keys(daily)
    .slice(0, 4)
    .forEach((day) => {
      const d = daily[day];
      const temp = Math.round(d.main.temp);
      const icon = d.weather[0].icon;

      container.innerHTML += `
        <div class="day">
          <span>${day}</span>
          <span>
            <img src="https://openweathermap.org/img/wn/${icon}.png" width="24" />
            ${temp}°C
          </span>
        </div>
      `;
    });
}


function handleMapInteraction() {
  if (!map) return;

  if (isPanelOpen) {
    map.dragging.disable();
    map.scrollWheelZoom.disable();
    map.doubleClickZoom.disable();
    map.boxZoom.disable();
    map.keyboard.disable();
  } else {
    map.dragging.enable();
    map.scrollWheelZoom.enable();
    map.doubleClickZoom.enable();
    map.boxZoom.enable();
    map.keyboard.enable();
  }
}


function initMap(lat, lon) {
  if (!map) {
    // ✅ Create map
    map = L.map("map").setView([lat, lon], 10);

    // ✅ Base map
    // 🌞 Light base map
    const lightBase = L.tileLayer(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      { attribution: "© OpenStreetMap" }
    );

    // 🌙 Dark base map
    const darkBase = L.tileLayer(
      "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
      { attribution: "© OpenStreetMap © CARTO" }
    );

    // Default base
    darkBase.addTo(map);

    // ☁️ Cloud layer
    cloudLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
      { opacity: 0.85 }
    );

    rainLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/precipitation_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
      { opacity: 0.8 }
    );

    const tempLayer = L.tileLayer(
      `https://tile.openweathermap.org/map/temp_new/{z}/{x}/{y}.png?appid=${API_KEY}`,
      { opacity: 0.6 }
    );

    // Default ON
    cloudLayer.addTo(map);

    // 📍 Marker
    marker = L.marker([lat, lon]).addTo(map);

    L.control
      .layers(
        {
          "🌙 Dark Map": darkBase,
          "🌞 Light Map": lightBase,
        },
        {
          "☁️ Clouds": cloudLayer,
          "🌧️ Rain": rainLayer,
          "🌡️ Temperature": tempLayer,
        },
        { collapsed: false }
      )
      .addTo(map);
  } else {
    if (map && marker) {
      map.flyTo([lat, lon], 10, { duration: 1.5 });
      marker.setLatLng([lat, lon]);
    }
  }

  // 🏷 Popup
  marker
    .bindPopup(
      `<b>${document.getElementById("cityName").innerText}</b><br>
       Temp: ${document.getElementById("rightTemp").innerText}`
    )
    .openPopup();
}

function updateHeroBackground(weatherMain, icon, pop = 0) {
  const hero = document.querySelector(".hero-card");

  hero.classList.remove(
    "hero-clear",
    "hero-clouds",
    "hero-rain",
    "hero-thunderstorm",
    "hero-snow",
    "hero-mist",
    "hero-night"
  );

  const isNight = icon.includes("n");
  const main = weatherMain.toLowerCase();

  // 🌙 Night override (only if no strong weather)
  if (isNight && pop < 0.3 && main === "clear") {
    hero.classList.add("hero-night");
    return;
  }

  // ⛈ Thunderstorm
  if (main === "thunderstorm") {
    hero.classList.add("hero-thunderstorm");
    return;
  }

  // 🌧 Rain OR high rain probability
  if (main === "rain" || main === "drizzle" || pop >= 0.4) {
    hero.classList.add("hero-rain");
    return;
  }

  // ❄ Snow
  if (main === "snow") {
    hero.classList.add("hero-snow");
    return;
  }

  // 🌫 Fog / Mist
  if (["mist", "fog", "haze", "smoke"].includes(main)) {
    hero.classList.add("hero-mist");
    return;
  }

  // ☁️ Clouds
  if (main === "clouds") {
    hero.classList.add("hero-clouds");
    return;
  }

  // 🌞 Clear fallback
  hero.classList.add(isNight ? "hero-night" : "hero-clear");
}

function updateRainDonut(data) {
  const ctx = document.getElementById("rainDonut");
  if (!ctx) return;

  const hours = data.list.slice(0, 8);
  const rainRisk = hours.filter((h) => (h.pop || 0) >= 0.3).length;
  const clear = hours.length - rainRisk;

  if (rainDonutChart) rainDonutChart.destroy();

  rainDonutChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Rain Risk", "Clear"],
      datasets: [
        {
          data: [rainRisk, clear],
          backgroundColor: ["#3b82f6", "#e5e7eb"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      cutout: "70%",
      centerText: `${Math.round((rainRisk / hours.length) * 100)}%`,
      plugins: {
        legend: { position: "bottom" },
      },
    },
  });
}

function updateTempComfortChart(data) {
  const ctx = document.getElementById("tempComfort");
  if (!ctx) return;

  let cold = 0,
    comfort = 0,
    hot = 0;

  data.list.slice(0, 8).forEach((h) => {
    if (h.main.temp < 18) cold++;
    else if (h.main.temp <= 28) comfort++;
    else hot++;
  });

  if (tempComfortChart) tempComfortChart.destroy();

  tempComfortChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Today"],
      datasets: [
        { label: "Cold", data: [cold], backgroundColor: "#60a5fa" },
        { label: "Comfortable", data: [comfort], backgroundColor: "#22c55e" },
        { label: "Hot", data: [hot], backgroundColor: "#f97316" },
      ],
    },
    options: {
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: { stacked: true },
        y: { stacked: true },
      },
    },
  });
}

function updateHumidityGauge(data) {
  const ctx = document.getElementById("humidityGauge");
  if (!ctx) return;

  const humidity = data.list[0].main.humidity;

  if (humidityGaugeChart) humidityGaugeChart.destroy();

  humidityGaugeChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      datasets: [
        {
          data: [humidity, 100 - humidity],
          backgroundColor: ["#f59e0b", "#e5e7eb"],
          borderWidth: 0,
        },
      ],
    },
    options: {
      rotation: -90,
      circumference: 180,
      cutout: "75%",
      centerText: `${humidity}%`,
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  });
}

function getGreetingByTime(date = new Date()) {
  const hour = date.getHours();

  if (hour >= 5 && hour < 12) return "Good Morning";
  if (hour >= 12 && hour < 17) return "Good Afternoon";
  if (hour >= 17 && hour < 21) return "Good Evening";
  return "Good Night";
}

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("chart-visible");
      }
    });
  },
  { threshold: 0.2 }
);

function updateComfortAI(data) {
  const current = data.list[0];

  const temp = current.main.temp;
  const humidity = current.main.humidity;
  const wind = current.wind.speed;
  const rain = (current.pop || 0) * 100;

  // =====================
  // SCORE CALCULATION
  // =====================
  let score = 100;

  if (temp < 18 || temp > 32) score -= 20;
  else if (temp < 20 || temp > 30) score -= 10;

  if (humidity > 80 || humidity < 30) score -= 15;
  else if (humidity > 65) score -= 8;

  if (rain > 60) score -= 25;
  else if (rain > 30) score -= 15;

  if (wind > 20) score -= 10;

  score = Math.max(0, Math.round(score));

  // =====================
  // LABEL + COLOR
  // =====================
  let label = "Comfortable";
  let colorClass = "score-mid";

  if (score >= 85) {
    label = "Excellent";
    colorClass = "score-good";
  } else if (score >= 70) {
    label = "Very Comfortable";
    colorClass = "score-good";
  } else if (score >= 50) {
    label = "Moderate";
    colorClass = "score-mid";
  } else {
    label = "Uncomfortable";
    colorClass = "score-bad";
  }

  // =====================
  // AI INSIGHT
  // =====================
  let insight = "";

  if (score >= 85) {
    insight = "Near-perfect weather today. Ideal for outdoor activities.";
  } else if (rain > 40) {
    insight = "Rain is likely today, which may affect outdoor plans.";
  } else if (humidity > 70) {
    insight = "High humidity may make the weather feel warmer.";
  } else if (wind > 15) {
    insight = "Breezy conditions could feel refreshing during the day.";
  } else {
    insight = "Weather conditions are stable with minimal discomfort.";
  }

  lastInsightText = insight;

  // =====================
  // BEST TIME TODAY
  // =====================
  const bestHour = data.list
    .slice(0, 8)
    .sort((a, b) => a.main.temp - b.main.temp)[0];

  const bestTime = new Date(bestHour.dt * 1000).getHours() + ":00";

  document.getElementById("bestTime").innerText =
    `Best time to go out: ${bestTime}`;

  // =====================
  // UPDATE UI
  // =====================
  animateScore(score, colorClass);
  document.getElementById("comfortLabel").innerText = label;
  document.getElementById("aiInsight").innerText = insight;
}

function animateScore(target, colorClass) {
  const el = document.getElementById("comfortScore");
  const wrap = document.getElementById("comfortScoreWrap");

  wrap.classList.remove("score-good", "score-mid", "score-bad");
  wrap.classList.add(colorClass);

  let current = 0;
  const step = Math.max(1, Math.floor(target / 40));

  const interval = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    el.innerText = current;
  }, 20);
}

function speakInsight() {
  if (!lastInsightText) return;

  const speech = new SpeechSynthesisUtterance(lastInsightText);
  speech.lang = "en-US";
  speech.rate = 0.95;
  speech.pitch = 1;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(speech);
}
