const clientId = 'cf0872f81fce49d88a9b88871839afa9'
const redirectUri = 'https://kozapawel.github.io/song-emotion/'

const urlParams = new URLSearchParams(window.location.search)
let code = urlParams.get('code')

let access_token = localStorage.getItem('access_token') || null
let refresh_token = localStorage.getItem('refresh_token') || null
let refreshed_at = localStorage.getItem('refreshed_at') || null

const bodyLoaded = () => {
  window.location.search.includes('error') &&
    window.history.replaceState({}, document.title, '/')

  const accessTokenValid = access_token && access_token != 'undefined'
  const refreshTokenValid = refresh_token && refresh_token != 'undefined'

  if (code) {
    getToken(code)
  } else if (accessTokenValid && refreshTokenValid && refreshed_at) {
    const authButton = document.getElementById('auth-button')
    authButton.innerHTML = `<text class="px-2">Logout</text>`
    authButton.onclick = function () {
      logout()
    }
  }
}

const checkToken = async () => {
  let lastRefresh
  if (refreshed_at) {
    lastRefresh = new Date(refreshed_at)
  } else {
    lastRefresh = false
  }

  if (lastRefresh) {
    const date = new Date()
    const timeDifference = date - lastRefresh

    if (timeDifference >= 21 || access_token == 'undefined') {
      await refreshToken()
    }
  } else {
    await refreshToken()
  }
}

const search = async () => {
  document.getElementById('song').innerHTML = ''
  const songsContainer = document.getElementById('songs')
  const songTitle = document.getElementById('song-title')

  if (songTitle.value == '' || songTitle.value.trim().length == 0) {
    songTitle.value = ''
    return
  } else {
    addSongsPlaceholder()
    songsContainer.innerHTML = ''
    songsContainer.classList.add('hidden')
    await checkToken()
  }

  const endpoint = 'https://api.spotify.com/v1/search?'
  const q = 'q=' + songTitle.value
  const type = ['album', 'artist', 'track']
  const limit = 20
  const imgPromises = []

  try {
    await fetch(endpoint + q + '&type=' + type + '&limit=' + limit, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        songTitle.placeholder = songTitle.value
        data.tracks.items.forEach((item) => {
          const songDiv = document.createElement('div')
          const imgPromise = new Promise((resolve) => {
            const img = new Image()
            img.onload = resolve
            img.src = item.album.images[1].url
          })
          imgPromises.push(imgPromise)

          songDiv.innerHTML = `
            <div class="w-full h-full flex items-start justify-start gap-4
             bg-zinc-600 p-2 rounded-md transition-colors duration-200 hover:bg-zinc-900 hover:cursor-pointer select-none">
              <img
                src="${item.album.images[1].url}"
                class="size-24 rounded-sm"
              />
              <div class="flex flex-col gap-2">
                <text class="text-gray-300 text-wrap">Song title:
                  <p class="text-white">${item.name}</p>
                </text>
                <text class="text-gray-300">${
                  item.album.artists.length > 1 ? 'Artists:' : 'Artist:'
                }
                    ${item.album.artists
                      .map(
                        (artist) => `<p class="text-white">${artist.name}</p>`
                      )
                      .join('')}
                </text>
                <text class="text-gray-300 max-w-96">Album:
                  <p class="text-white">${item.album.name}</p>
                </text>
              </div>
            </div>
          `
          songDiv.classList.add('col-span-4')
          songDiv.classList.add('md:col-span-2')
          songDiv.classList.add('lg:col-span-1')

          songDiv.onclick = function () {
            getTrackFeatures(item)
          }
          songsContainer.appendChild(songDiv)
        })
        songsContainer.childNodes.length == 0 &&
          (songsContainer.innerHTML = `<h2 class="text-2xl col-span-4">No result for "${songTitle.value}"</h2>`)
      })
  } catch (error) {
    if (access_token) {
      songsContainer.innerHTML = `<h2 class="text-2xl col-span-4">An error occured. Please try again later.</h2>`
    } else {
      songsContainer.innerHTML = `<h2 class="text-2xl col-span-4">Log in to continue.</h2>`
    }

    console.error(error.message)
  }

  Promise.all(imgPromises).then(() => {
    songsContainer.classList.remove('hidden')
    removePlaceholder()
  })
  songTitle.value = ''
}

const getTrackFeatures = async (song) => {
  document
    .getElementById('content-container')
    .scrollTo({ top: 0, behavior: 'smooth' })
  document.getElementById('song').innerHTML = ''

  const endpoint = 'https://api.spotify.com/v1/audio-features/'
  await checkToken()

  try {
    await fetch(endpoint + song.id, {
      method: 'GET',
      headers: {
        Authorization: 'Bearer ' + access_token,
      },
    })
      .then((response) => response.json())
      .then((data) => {
        checkEmotion(song, data)
      })
  } catch (error) {
    console.error(error.message)
  }
}

const checkEmotion = (songInfo, songFeatures) => {
  let isInX = false
  let isInY = false
  let inEmotion = []
  const songContainer = document.getElementById('song')
  songContainer.innerHTML = ''

  emotions.forEach((emotion) => {
    isInX =
      songFeatures.valence >= emotion.x1 && songFeatures.valence <= emotion.x2
    isInY =
      songFeatures.energy >= emotion.y1 && songFeatures.energy <= emotion.y2

    isInX && isInY ? inEmotion.push(emotion) : null
  })

  const songDiv = document.createElement('div')
  songDiv.innerHTML = `
    <div class="flex md:flex-row flex-col gap-4 mb-4">
      <img
        src=${songInfo.album.images[0].url}
        class="size-1/2 rounded-md"
      />
      <div class="flex flex-col justify-start gap-4">
        <text
          class="text-7xl md:text-8xl back-shadow select-none break-all md:break-keep"
          >${inEmotion
            .map(
              (emotion) =>
                `<p class="text-white ${emotion.class}">${emotion.name}</p>`
            )
            .join('')}</text
        >
        <div class="flex flex-col">
          <text class="text-gray-300 max-w-96 text-wrap"
            >Song title:
            <p class="text-white">${songInfo.name}</p>
          </text>
          <text class="text-gray-300"
            >${songInfo.album.artists.length > 1 ? 'Artists:' : 'Artist:'}
                ${songInfo.album.artists
                  .map((artist) => `<p class="text-white">${artist.name}</p>`)
                  .join('')}
          </text>
          <text class="text-gray-300 max-w-96"
            >Album:
            <p class="text-white">${songInfo.album.name}</p>
          </text>
        </div>
        <a 
          href=${songInfo.external_urls.spotify}
          target="_blank"
          class="group flex flex-row gap-1 px-4 py-2 items-center font-bold justify-center select-none
          bg-white text-zinc-800 rounded-md w-full ease-in-out transition-transform duration-200 
          hover:scale-110 hover:cursor-pointer hover:shadow-lg hover:shadow-green-600/60 hover:text-green-700"
        >
          <text>Open</text>
          <svg
            class="group-hover:fill-green-700"
            xmlns="http://www.w3.org/2000/svg"
            width="30"
            height="30"
            fill="#27272a"
            viewBox="0 0 256 256"
          >
            <path
              d="M228,104a12,12,0,0,1-24,0V69l-59.51,59.51a12,12,0,0,1-17-17L187,52H152a12,12,0,0,1,0-24h64a12,12,0,0,1,12,12Zm-44,24a12,12,0,0,0-12,12v64H52V84h64a12,12,0,0,0,0-24H48A20,20,0,0,0,28,80V208a20,20,0,0,0,20,20H176a20,20,0,0,0,20-20V140A12,12,0,0,0,184,128Z"
            ></path>
          </svg>
        </a>
      </div>
    </div>
  `

  songContainer.appendChild(songDiv)
}

const addSongsPlaceholder = () => {
  const placeholder = document.createElement('div')
  const contentDiv = document.getElementById('content-container')
  const numOfPlaceholders = Array(20).fill(0)

  placeholder.id = 'songs-placeholder'
  placeholder.innerHTML = `
    <div class="grid grid-cols-4 w-full gap-4">
        ${numOfPlaceholders
          .map(
            () =>
              `
              <div class="flex items-start col-span-4 md:col-span-2 lg:col-span-1 min-w-full min-h-full bg-zinc-600 p-2 rounded-md gap-4">
                <div class="bg-zinc-200 h-20 w-28 rounded-sm placeholder-animation"></div>
                <div class="flex flex-col gap-4 w-full">
                  <div class="bg-zinc-200 rounded-sm h-5 placeholder-animation"></div>
                  <div class="bg-zinc-200 rounded-sm h-5 placeholder-animation"></div>
                  <div class="bg-zinc-200 rounded-sm h-5 placeholder-animation"></div>
                </div>
              </div>
          `
          )
          .join('')}
    </div>
  `
  contentDiv.appendChild(placeholder)
}

const removePlaceholder = () => {
  const placeholder = document.getElementById('songs-placeholder')
  placeholder.remove()
}

// https://developer.spotify.com/documentation/web-api/tutorials/code-pkce-flow

const generateRandomString = (length) => {
  const possible =
    'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const values = crypto.getRandomValues(new Uint8Array(length))
  return values.reduce((acc, x) => acc + possible[x % possible.length], '')
}

const generateCodeChallende = async (codeVerifier) => {
  const input = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(codeVerifier)
  )

  return btoa(String.fromCharCode(...new Uint8Array(input)))
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const generateUrlWithSearchParams = (url, params) => {
  const urlObject = new URL(url)
  urlObject.search = new URLSearchParams(params).toString()

  return urlObject.toString()
}

const processTokenResponse = (data) => {
  access_token = data.access_token
  refresh_token = data.refresh_token

  localStorage.setItem('access_token', access_token)
  localStorage.setItem('refresh_token', refresh_token)
  localStorage.setItem('refreshed_at', new Date())
}

const authorizeUser = async () => {
  const codeVerifier = generateRandomString(64)

  generateCodeChallende(codeVerifier).then((codeChallenge) => {
    window.localStorage.setItem('code_verifier', codeVerifier)

    window.location = generateUrlWithSearchParams(
      'https://accounts.spotify.com/authorize',
      {
        response_type: 'code',
        client_id: clientId,
        scope: 'user-read-private user-read-email',
        code_challenge_method: 'S256',
        code_challenge: codeChallenge,
        redirect_uri: redirectUri,
      }
    )
  })
}

const getToken = (code) => {
  const codeVerifier = localStorage.getItem('code_verifier')

  try {
    fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
      },
      body: new URLSearchParams({
        client_id: clientId,
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: codeVerifier,
      }),
    })
      .then((response) => response.json())
      .then((data) => {
        processTokenResponse(data)

        window.history.replaceState({}, document.title, '/')
        window.location.reload()
      })
  } catch (error) {
    console.error(error.message)
  }
}

const refreshToken = async () => {
  try {
    await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refresh_token,
        client_id: clientId,
      }),
    })
      .then((response) => response.json())
      .then((data) => processTokenResponse(data))
  } catch (error) {
    console.error(error.message)
  }
}

const logout = () => {
  localStorage.clear()
  window.location.reload()
}

const emotions = [
  (angry = {
    x1: 0.0,
    x2: 0.333,
    y1: 0.75,
    y2: 1.0,
    name: 'Angry',
    class: 'shadow-angry',
  }),
  (excited = {
    x1: 0.333,
    x2: 0.666,
    y1: 0.75,
    y2: 1.0,
    name: 'Excited',
    class: 'shadow-excited',
  }),
  (happy = {
    x1: 0.666,
    x2: 1.0,
    y1: 0.75,
    y2: 1.0,
    name: 'Happy',
    class: 'shadow-happy',
  }),
  (nervous = {
    x1: 0.0,
    x2: 0.333,
    y1: 0.5,
    y2: 0.75,
    name: 'Nervous',
    class: 'shadow-nervous',
  }),
  (calm = {
    x1: 0.333,
    x2: 0.666,
    y1: 0.25,
    y2: 0.75,
    name: 'Calm',
    class: 'shadow-calm',
  }),
  (pleased = {
    x1: 0.666,
    x2: 1.0,
    y1: 0.5,
    y2: 0.75,
    name: 'Pleased',
    class: 'shadow-pleased',
  }),
  (bored = {
    x1: 0.0,
    x2: 0.333,
    y1: 0.25,
    y2: 0.5,
    name: 'Bored',
    class: 'shadow-bored',
  }),
  (relaxed = {
    x1: 0.666,
    x2: 1.0,
    y1: 0.25,
    y2: 0.5,
    name: 'Relaxed',
    class: 'shadow-relaxed',
  }),
  (sad = {
    x1: 0.0,
    x2: 0.333,
    y1: 0.0,
    y2: 0.25,
    name: 'Sad',
    class: 'shadow-sad',
  }),
  (sleepy = {
    x1: 0.333,
    x2: 0.666,
    y1: 0.0,
    y2: 0.25,
    name: 'Sleepy',
    class: 'shadow-sleepy',
  }),
  (peaceful = {
    x1: 0.333,
    x2: 0.666,
    y1: 0.0,
    y2: 0.25,
    name: 'Peaceful',
    class: 'shadow-peaceful',
  }),
]
