import React, { useState, useEffect, useRef } from 'react';

const backgroundMusic = new Audio(process.env.PUBLIC_URL + '/audio/orbit-soundtrack.mp3');

const App = () => {
  const [gameState, setGameState] = useState({
    sunPosition: { x: window.innerWidth / 2, y: window.innerHeight / 2 },
    sunHealth: 100,
    score: 0,
    planets: [
      { id: 1, distance: 100, angle: 0, speed: 0.02, color: '#3498db', size: 15 },
      { id: 2, distance: 180, angle: 2, speed: 0.015, color: '#e74c3c', size: 20 },
      { id: 3, distance: 260, angle: 4, speed: 0.01, color: '#2ecc71', size: 25 }
    ],
    asteroids: [],
    explosions: [],
    gameOver: false,
    gameStarted: false,
    isMuted: false,
    difficulty: 1,
    lastAsteroidSpawn: 0
  });

  const [stars, setStars] = useState([]);
  const [flickeringStars, setFlickeringStars] = useState([]);

  const keysPressed = useRef({});
  const lastUpdateTime = useRef(0);
  const requestRef = useRef();
  const sunSize = 60;

  useEffect(() => {
    backgroundMusic.loop = true;
    backgroundMusic.volume = 0.5;

    return () => {
      backgroundMusic.pause();
      backgroundMusic.currentTime = 0;
    };
  }, []);

  useEffect(() => {
    backgroundMusic.muted = gameState.isMuted;
  }, [gameState.isMuted]);

  const startGame = () => {
    setGameState(prevState => ({ ...prevState, gameStarted: true }));
    backgroundMusic.play().catch(error => console.log("Audio play failed:", error));
  };

  const toggleMute = () => {
    setGameState(prevState => ({ ...prevState, isMuted: !prevState.isMuted }));
  };
  useEffect(() => {

    const handleKeyDown = (e) => {
      keysPressed.current[e.key] = true;
      if (!gameState.gameStarted) {
        setGameState(prev => ({ ...prev, gameStarted: true }));
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key] = false;
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [gameState.gameStarted]);

  useEffect(() => {
    setStars(Array.from({ length: 200 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 2 + 1,
      speed: Math.random() * 0.5 + 0.1
    })));
  
    setFlickeringStars(Array.from({ length: 50 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      size: Math.random() * 3 + 2,
      flickerSpeed: Math.random() * 0.1 + 0.05
    })));
  }, []);

  const updateGameState = (time) => {
    if (gameState.gameOver || !gameState.gameStarted) return;
  
    const deltaTime = time - lastUpdateTime.current;
    lastUpdateTime.current = time;
  
    setGameState(prevState => {
      const moveStep = 0.3 * deltaTime;
      let newSunPosition = { ...prevState.sunPosition };
      if (keysPressed.current.ArrowUp) newSunPosition.y = Math.max(sunSize/2, newSunPosition.y - moveStep);
      if (keysPressed.current.ArrowDown) newSunPosition.y = Math.min(window.innerHeight - sunSize/2, newSunPosition.y + moveStep);
      if (keysPressed.current.ArrowLeft) newSunPosition.x = Math.max(sunSize/2, newSunPosition.x - moveStep);
      if (keysPressed.current.ArrowRight) newSunPosition.x = Math.min(window.innerWidth - sunSize/2, newSunPosition.x + moveStep);
  
      const newDifficulty = Math.min(10, prevState.difficulty + deltaTime / 100000);
  
      const newPlanets = prevState.planets.map(planet => ({
        ...planet,
        angle: (planet.angle + planet.speed * deltaTime / 50) % (2 * Math.PI)
      }));
  
      const asteroidSpawnInterval = 2000 / newDifficulty;
      const shouldSpawnAsteroid = time - prevState.lastAsteroidSpawn > asteroidSpawnInterval;
  
      let newAsteroids = prevState.asteroids
        .map(asteroid => ({
          ...asteroid,
          x: asteroid.x + asteroid.vx * deltaTime / 50,
          y: asteroid.y + asteroid.vy * deltaTime / 50,
          trail: [...asteroid.trail, { x: asteroid.x, y: asteroid.y }].slice(-50)
        }))
        .filter(asteroid => 
          asteroid.x > -50 && asteroid.x < window.innerWidth + 50 &&
          asteroid.y > -50 && asteroid.y < window.innerHeight + 50
        );
  
      if (shouldSpawnAsteroid) {
        const side = Math.floor(Math.random() * 4);
        const newAsteroid = {
          x: side % 2 === 0 ? Math.random() * window.innerWidth : (side === 1 ? window.innerWidth + 50 : -50),
          y: side % 2 === 1 ? Math.random() * window.innerHeight : (side === 2 ? window.innerHeight + 50 : -50),
          vx: (Math.random() - 0.5) * 4 * newDifficulty,
          vy: (Math.random() - 0.5) * 4 * newDifficulty,
          size: Math.random() * 20 + 10,
          trail: []
        };
        newAsteroids.push(newAsteroid);
      }
  
      if (Math.random() < 0.005 * deltaTime / 50) {
        const newPlanet = {
          id: Date.now(),
          distance: Math.random() * 200 + 150,
          angle: Math.random() * 2 * Math.PI,
          speed: Math.random() * 0.02 + 0.005,
          color: `hsl(${Math.random() * 360}, 70%, 50%)`,
          size: Math.random() * 15 + 15
        };
        newPlanets.push(newPlanet);
      }
  
      const checkCollision = (obj1, obj2, distance) => {
        const dx = obj1.x - obj2.x;
        const dy = obj1.y - obj2.y;
        return Math.sqrt(dx * dx + dy * dy) < distance;
      };
  
      let newSunHealth = prevState.sunHealth;
      let newExplosions = [...prevState.explosions];
  
      newAsteroids.forEach(asteroid => {
        if (checkCollision(newSunPosition, asteroid, (sunSize + asteroid.size) / 2)) {
          newSunHealth = 0;  // Instant game over if sun hits asteroid
          newExplosions.push({ x: asteroid.x, y: asteroid.y, size: 100, age: 0 });
        }
  
        newPlanets.forEach(planet => {
          const planetPos = {
            x: newSunPosition.x + Math.cos(planet.angle) * planet.distance,
            y: newSunPosition.y + Math.sin(planet.angle) * planet.distance
          };
          if (checkCollision(planetPos, asteroid, (planet.size + asteroid.size) / 2)) {
            const index = newPlanets.findIndex(p => p.id === planet.id);
            if (index > -1) {
              newPlanets.splice(index, 1);
              newSunHealth = Math.max(0, newSunHealth - 20);
              newExplosions.push({ x: planetPos.x, y: planetPos.y, size: 50, age: 0 });
            }
          }
        });
      });
  
      newExplosions = newExplosions.map(exp => ({ ...exp, age: exp.age + deltaTime / 50 }))
                                   .filter(exp => exp.age < 1);
  
      const newScore = prevState.score + deltaTime / 50;
  
      const gameOver = newSunHealth <= 0;
  
      setStars(prevStars => prevStars.map(star => ({
        ...star,
        y: (star.y + star.speed) % window.innerHeight
      })));
  
      return {
        ...prevState,
        sunPosition: newSunPosition,
        sunHealth: newSunHealth,
        score: newScore,
        planets: newPlanets,
        asteroids: newAsteroids,
        explosions: newExplosions,
        gameOver: gameOver,
        difficulty: newDifficulty,
        lastAsteroidSpawn: shouldSpawnAsteroid ? time : prevState.lastAsteroidSpawn
      };
    });
  
    requestRef.current = requestAnimationFrame(updateGameState);
  };

  useEffect(() => {
    requestRef.current = requestAnimationFrame(updateGameState);
    return () => cancelAnimationFrame(requestRef.current);
  }, [gameState.gameStarted, gameState.gameOver]);
  const Sun = ({ x, y }) => (
    <div style={{
      position: 'absolute',
      left: x - sunSize / 2,
      top: y - sunSize / 2,
      width: sunSize,
      height: sunSize,
      borderRadius: '50%',
      background: `radial-gradient(circle, #fff700 0%, #ff9900 70%, #ff6600 100%)`,
      boxShadow: `0 0 20px #ff9900, 0 0 60px #ff6600`,
      filter: `brightness(${gameState.sunHealth / 100})`
    }} />
  );
  const Planet = ({ distance, angle, color, size }) => {
    const x = gameState.sunPosition.x + Math.cos(angle) * distance;
    const y = gameState.sunPosition.y + Math.sin(angle) * distance;
    return (
      <>
        <div style={{
          position: 'absolute',
          left: x - size / 2,
          top: y - size / 2,
          width: size,
          height: size,
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: `0 0 10px ${color}`
        }} />
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          <circle
            cx={gameState.sunPosition.x}
            cy={gameState.sunPosition.y}
            r={distance}
            fill="none"
            stroke={color}
            strokeWidth="1"
            strokeDasharray="5,5"
            opacity="0.5"
          />
        </svg>
      </>
    );
  };

  const Asteroid = ({ x, y, size, trail }) => (
    <>
      {trail.map((pos, index) => (
        <div key={index} style={{
          position: 'absolute',
          left: pos.x - size / 4,
          top: pos.y - size / 4,
          width: size / 2,
          height: size / 2,
          borderRadius: '50%',
          backgroundColor: `rgba(255, 165, 0, ${(index / trail.length) * 0.7})`,
          boxShadow: `0 0 ${index / trail.length * 15}px rgba(255, 165, 0, ${(index / trail.length) * 0.7})`,
          animation: 'flash 0.5s infinite alternate'
        }} />
      ))}
      <div style={{
        position: 'absolute',
        left: x - size / 2,
        top: y - size / 2,
        width: size,
        height: size,
        borderRadius: '50%',
        background: `radial-gradient(circle, #ff9900 0%, #ff6600 70%, #ff4500 100%)`,
        boxShadow: '0 0 10px #ff6600, 0 0 30px #ff4500'
      }} />
    </>
  );

  const Explosion = ({ x, y, size, age }) => (
    <div style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle, rgba(255,255,255,${1-age}) 0%, rgba(255,165,0,${1-age}) 50%, rgba(255,0,0,${1-age}) 100%)`,
      opacity: 1 - age,
      transform: `scale(${1 + age})`
    }} />
  );

  const PlayScreen = ({ startGame, toggleMute, isMuted }) => (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      width: '100%',
      height: '100%',
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      background: 'rgba(0, 0, 0, 0.7)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
    }}>
      <h1 style={{
        fontSize: '72px',
        marginBottom: '20px',
        textShadow: '0 0 10px #00ffff, 0 0 20px #00ffff, 0 0 30px #00ffff',
      }}>
        In Orbit
      </h1>
      <p style={{
        fontSize: '24px',
        maxWidth: '600px',
        textAlign: 'center',
        marginBottom: '40px',
        lineHeight: '1.5',
      }}>
        Navigate your star through a perilous asteroid field. Protect your planets and survive as long as you can!
      </p>
      <button 
        onClick={startGame}
        style={{
          fontSize: '28px',
          padding: '15px 30px',
          backgroundColor: 'transparent',
          color: 'white',
          border: '2px solid #00ffff',
          borderRadius: '50px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          marginBottom: '20px',
        }}
      >
        Press Arrow Keys To Play
      </button>
      <button 
        onClick={toggleMute}
        style={{
          fontSize: '18px',
          padding: '10px 20px',
          backgroundColor: 'transparent',
          color: 'white',
          border: '1px solid white',
          borderRadius: '25px',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
        }}
      >
        {isMuted ? 'Unmute' : 'Mute'}
      </button>
    </div>
  );

  return (
    <div style={{
      width: '100%',
      height: '100vh',
      backgroundColor: 'black',
      position: 'relative',
      overflow: 'hidden'
    }}>
      <style>
        {`
          @keyframes flash {
            0% { opacity: 0.3; }
            100% { opacity: 1; }
          }
          @keyframes flicker {
            0% { opacity: 0.5; }
            50% { opacity: 1; }
            100% { opacity: 0.5; }
          }
        `}
      </style>
      {stars.map((star, index) => (
        <div key={index} style={{
          position: 'absolute',
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: '50%',
          backgroundColor: 'white'
        }} />
      ))}
      {flickeringStars.map((star, index) => (
        <div key={`flicker-${index}`} style={{
          position: 'absolute',
          left: star.x,
          top: star.y,
          width: star.size,
          height: star.size,
          borderRadius: '50%',
          backgroundColor: 'white',
          animation: `flicker ${star.flickerSpeed}s infinite`
        }} />
      ))}
      {gameState.gameStarted && (
        <>
          <Sun x={gameState.sunPosition.x} y={gameState.sunPosition.y} />
          {gameState.planets.map(planet => (
            <Planet key={planet.id} {...planet} />
          ))}
          {gameState.asteroids.map((asteroid, index) => (
            <Asteroid key={index} {...asteroid} />
          ))}
          {gameState.explosions.map((explosion, index) => (
            <Explosion key={index} {...explosion} />
          ))}
          <div style={{
            position: 'absolute',
            top: 10,
            left: 10,
            color: 'white',
            fontSize: '18px'
          }}>
            Score: {Math.floor(gameState.score)} - Sun Health: {Math.floor(gameState.sunHealth)}%
          </div>
        </>
      )}
      {!gameState.gameStarted && <PlayScreen startGame={startGame} toggleMute={toggleMute} isMuted={gameState.isMuted} />}
      {gameState.gameOver && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          color: 'white',
          fontSize: '36px',
          textAlign: 'center',
          backgroundColor: 'rgba(0, 0, 0, 0.7)',
          padding: '20px',
          borderRadius: '10px'
        }}>
          <div>Game Over!</div>
          <div>Final Score: {Math.floor(gameState.score)}</div>
          <button onClick={() => window.location.reload()} style={{
            marginTop: '20px',
            padding: '10px 20px',
            fontSize: '18px',
            cursor: 'pointer'
          }}>
            Play Again
          </button>
        </div>
      )}
    </div>  );
};

export default App;