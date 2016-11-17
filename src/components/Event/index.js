import { h, Component } from 'preact';
import { Link } from 'preact-router';
import style from './style';

import Track from '../Track';

export default class Event extends Component {
  render() {
    const { events, id } = this.props;

    const event = events.find(event => event.id === +id);

    let EventItem;
    let title;

    if (event) {
      title = event.title ? event.title : event.performances.map(performance => (
        <Link class={style[performance.type]} href={`/artist/${performance.id}`} >
          {performance.name}
        </Link>
      ));

      EventItem = (
        <div>
        <time class={style.date} datetime={event.time.iso}>
          {event.time.pretty.full}
        </time>
        {event.reason.attendance && event.reason.attendance === 'im_going' && (
          <span class={style.attendance}>✔ Im going</span>
        )}

        {event.type === 'festival' && (
          <span class={style.festival}>Festival</span>
        )}

        <h1 class={style.title}>{title}</h1>
        <h3 class={style.place}>{event.place.name}</h3>

        <h4>Tickets</h4>

        <a class={style.button} href={event.uri} target="_blank">Buy tickets!</a>

        <h4>Venue & Directions</h4>

        <p>{event.place.name}</p>

        <a class={style.button} href={`http://maps.google.com/?q=${event.place.name}`} target="_blank">
          Get directions here…
        </a>

        <h4>Doors Open</h4>

        <p>{event.time.pretty.doors}</p>

        <h4>Lineup</h4>

        <ol>
          {event.performances.map(performance => (
            <li class={style.artist}>
              <Link href={`/artist/${performance.id}`}>
                <img src={performance.image} alt={`Image of ${performance.name}`} />
                <span class={performance.type === 'headline' ? style.headliner : {}}>{performance.name}</span>
              </Link>
              <Track name={performance.name} />
            </li>
          ))}
        </ol>
      </div>
      );
    }

    return (
      <div>
        <div class={style.headerImage}>
          {event && <img src={event.image} alt="Image for event" />}
        </div>
        <div class={`${style.page} ${style.panel}`}>
          {EventItem}
        </div>
      </div>
		);
  }
}
