/*
* 	
*/
import * as request from 'request';
import { checkToken } from './SpotifyAuthentication';
import { subtractVectors } from './Helper';
import { parseDate } from 'tough-cookie';
import { AudioFeaturesObject, TrackObject } from '../types';

/*
*	
*/
function search(searchParams:any, token: string) {
  return new Promise<TrackObject[]>(function (resolve, reject) {

    const options = {
      url: 'https://api.spotify.com/v1/search/?q=' 
            + searchParams.query.join('%20')
            + '%20year:' + searchParams.yearRange[0]
            + '-' + searchParams.yearRange[1] 
            +  ( (searchParams.genre == 'Any') ? ''  : '%20genre:%22' + searchParams.genre.join('%20') + '%22') 
            + '&type=track&limit=50'
            + '&offset=' + searchParams.offset,
      headers: {
        'Authorization': 'Bearer ' + token
      },
      json: true
    };

    request.get(options, function(error: any, response: any, body: any) {
      if (!error && response.statusCode === 200) {

        let featureVectorWithinTolerance = function(track:TrackObject) {
          if (track.audio_features) {
            let difference = subtractVectors(track.audio_features, searchParams.audioFeatures);
            let distance = difference.reduce( (acc:number, cur:number) =>  acc + Math.pow(cur,2), 0 );
            if (distance < searchParams.audioFeatureTolerance) {
              return true;
            }
          }
          else {
            return false;
          }
        }
          
        let trackWithinPopularityRange = function(track:TrackObject) {
          if (track.popularity > searchParams.popularityRange[0] && track.popularity < searchParams.popularityRange[1]) {
            return true;
          }
        }

        let trackWithinDurationRange = function(track:TrackObject) {
          if (track.duration_ms > searchParams.durationRange[0] && track.duration_ms < searchParams.durationRange[1]) {
            return true;
          }
        }

        let trackWithinExplicitFilter = function(track:TrackObject) {
          switch(searchParams.explicit) {
            case 'allow':
              return true;
              break;
            case 'exclude':
              if (track.explicit) {
                return false;
              }
              else {
                return true;
              }
              break;
            case 'explicit': 
              if (track.explicit) {
                return true;
              }
              else {
                return false;
              }
              break;
            }
          }

        // get list of tracks from search results
        var searchResultTracks:TrackObject[] = body.tracks.items;
        var filteredTracks:TrackObject[] = [];
        
        console.log(searchResultTracks[0])

        // get audio features for search results
        let trackIds:string[] = searchResultTracks.map( (track:TrackObject) => track.id );

        // if no tracks are found return empty array
        if (trackIds.length < 1) {
          resolve([]);
        }
        // if we've got tracks let's filter them
        else {
          getAudioFeatures(trackIds, token)
          .then(function(audioFeatures) {
            audioFeatures.filter( (f:AudioFeaturesObject) => f != null ).map( function(f:AudioFeaturesObject, index:number) {

              let featureVector = [f.danceability, f.energy, f.mode, f.acousticness, f.instrumentalness, f.liveness, f.valence] 
              let tempTracks = searchResultTracks[index];
              
              tempTracks.audio_features = featureVector;
              filteredTracks.push(tempTracks);
            });
            
            // if user includes audio features use them to filter the search
            if (searchParams.audioFeatures.every( (element:number) => !isNaN(element)) ) {
              filteredTracks = filteredTracks.filter(featureVectorWithinTolerance);
            }
            // filter by popularity
            filteredTracks = filteredTracks.filter(trackWithinPopularityRange);
            // filter by duration
            filteredTracks = filteredTracks.filter(trackWithinDurationRange);
            // filter by explicit
            filteredTracks = filteredTracks.filter(trackWithinExplicitFilter);

            resolve(filteredTracks)
          }, function(error) {
            console.log(error)
            reject(error);
          });
        }
      }
      else {
        reject(error);
      }
    });
  });
}

function getAudioFeatures(ids:string[], token:string) {
	return new Promise<AudioFeaturesObject[]>(function (resolve, reject) {
  
	  const options = {
		  url: 'https://api.spotify.com/v1/audio-features/?ids=' + ids.join(),
		  headers: {
			'Authorization': 'Bearer ' + token
		  },
		  json: true
	  };
  
	  request.get(options, function(error: any, response: any, body: any) {
			  if (!error && response.statusCode === 200) {
          resolve(body.audio_features);
			  }
			  else {
				  reject(error);
			  }
		  });
	});
  }

export { search, getAudioFeatures }