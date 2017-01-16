import { Component, OnInit, ViewContainerRef } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { RouterExtensions } from 'nativescript-angular/router';
import { ModalDialogService, ModalDialogOptions } from 'nativescript-angular/modal-dialog';
import * as utils from 'utils/utils';

import { EventsService, UsersService, AlertService } from '../../services';
import { Event, User } from '../../shared/models';
import { utilities } from '../../shared';
import { EventRegistrationModalComponent } from '../event-registration-modal/event-registration-modal.component';

@Component({
    selector: 'event-details',
    templateUrl: 'events/event-details/event-details.template.html',
    styleUrls: [ 'events/event-details/event-details.component.css' ]
})
export class EventDetailsComponent implements OnInit {
    event: Event;
    dateFormat = utilities.dateFormat;
    registeredUsers: User[] = [];
    remainingUsersCount: number = 0;
    alreadyRegistered = false;
    isPastEvent = false;
    registeredUsersExpanded = false;

    private _currentUser: User;

    constructor(
        private _route: ActivatedRoute,
        private _alertsService: AlertService,
        private _eventsService: EventsService,
        private _usersService: UsersService,
        private _modalService: ModalDialogService,
        private _vcRef: ViewContainerRef,
        private _routerExtensions: RouterExtensions
    ) { }

    ngOnInit() {
        this._route.params.subscribe(p => {
            let eventId = p['id'];
            this._eventsService.getById(eventId)
                .then((event) => {
                    this.event = event;
                    this.isPastEvent = this._eventsService.isPastEvent(this.event);
                })
                .catch(this._onError.bind(this));

            this._usersService.currentUser()
                .then(currentUser => {
                    this._currentUser = currentUser;
                    return this._eventsService.getParticipants(eventId);
                })
                .then((participants) => {
                    this.registeredUsers = participants;
                    this.alreadyRegistered = this.registeredUsers.some(u => u.Id === this._currentUser.Id);
                    this.remainingUsersCount = Math.max(0, this.registeredUsers.length - 3);
                })
                .catch(this._onError.bind(this));
        });
    }

    onEdit() {
        this._routerExtensions.navigate([`/events/${this.event.Id}/edit`]);
    }

    canEdit() {
        return this._currentUser && this.event && this.event.Owner === this._currentUser.Id;
    }

    getDate() {
        if (this.event.EventDate) {
            return new Date(this.event.EventDate);
        }
    }

    register() {
        if (this.alreadyRegistered) {
            return;
        }

        let registrationPromise: Promise<any>;

        if (this.event.EventDate) {
            registrationPromise = this._eventsService.registerForEvent(this.event.Id, [0]);
        } else {
            registrationPromise = this._openPopupAndRegister();
        }
            
        registrationPromise.then((didRegister) => {
            if (didRegister) { // would be false if user closed modal
                this.alreadyRegistered = true;
                this.registeredUsers.unshift(this._currentUser);
            }
        })
        .catch(this._onError.bind(this));
    }

    showLocation() {
        utils.openUrl(this.event.LocationURL);
    }

    toggleExpandedUsers() {
        this.registeredUsersExpanded = !this.registeredUsersExpanded;
    }

    collapseExpandedUsers() {
        this.registeredUsersExpanded = false;
    }

    getAllRegisteredUserNames() {
        return this.registeredUsers.map(u => u.DisplayName || u.Username).join(', ');
    }

    private _openPopupAndRegister() {
        let opts: ModalDialogOptions = {
            context: {
                availableDates: this.event.EventDateChoices
            },
            fullscreen: true,
            viewContainerRef: this._vcRef
        };

        return this._modalService.showModal(EventRegistrationModalComponent, opts)
            .then((dateChoices: number[]) => {
                if (dateChoices && dateChoices.length) {
                    return this._eventsService.registerForEvent(this.event.Id, dateChoices);
                } else {
                    return Promise.resolve(false);
                }
            });
    }

    private _onError(err) {
        if (err) {
            this._alertsService.showError(err && err.message);
        }
    }
}
