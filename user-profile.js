/**
 * User Profile Management Script
 * This script handles user profile data and photo display across the website
 */

// Function to load user data from localStorage
function getUserData() {
    const userString = localStorage.getItem('user');
    if (!userString) return null;
    return JSON.parse(userString);
}

// Function to update user navigation with profile photo
function updateUserNavigation() {
    const user = getUserData();
    if (!user) return;

    // Find all nav-right elements
    const navRightElements = document.querySelectorAll('.nav-right');
    
    navRightElements.forEach(navRight => {
        // Check if this nav-right already has user profile elements
        if (navRight.querySelector('.user-profile-container')) return;
        
        // Create user profile container
        const userProfileContainer = document.createElement('div');
        userProfileContainer.className = 'user-profile-container';
        userProfileContainer.style.display = 'flex';
        userProfileContainer.style.alignItems = 'center';
        userProfileContainer.style.gap = '10px';
        
        // Create notification icon (optional)
        const notificationContainer = document.createElement('div');
        notificationContainer.style.position = 'relative';
        notificationContainer.style.marginRight = '15px';
        notificationContainer.innerHTML = `
            <i class="fas fa-bell" style="font-size: 1.2rem; color: #3366ff; cursor: pointer;"></i>
            <span style="position: absolute; top: -8px; right: -8px; background: #ff3366; color: white; border-radius: 50%; font-size: 0.7rem; padding: 2px 6px; font-weight: 700;">3</span>
        `;
        
        // Create profile photo element
        const profilePhotoContainer = document.createElement('div');
        profilePhotoContainer.style.display = 'flex';
        profilePhotoContainer.style.alignItems = 'center';
        profilePhotoContainer.style.gap = '10px';
        
        const profilePhoto = document.createElement('img');
        profilePhoto.id = 'profilePhoto';
        profilePhoto.alt = 'User Profile';
        profilePhoto.style.width = '36px';
        profilePhoto.style.height = '36px';
        profilePhoto.style.borderRadius = '50%';
        profilePhoto.style.objectFit = 'cover';
        
        // Set profile photo source
        if (user.profilePhoto) {
            profilePhoto.src = user.profilePhoto;
        } else if (user.profilePhotoUrl) {
            profilePhoto.src = user.profilePhotoUrl;
        } else {
            profilePhoto.src = 'profile-placeholder.jpg';
        }
        
        // Create username element
        const userName = document.createElement('span');
        userName.id = 'userName';
        userName.style.fontWeight = '600';
        userName.textContent = `${user.firstName || 'User'}`;
        
        // Assemble the profile container
        profilePhotoContainer.appendChild(profilePhoto);
        profilePhotoContainer.appendChild(userName);
        
        // Add logout functionality with dropdown
        const userMenu = document.createElement('div');
        userMenu.className = 'user-menu-dropdown';
        userMenu.style.position = 'relative';
        userMenu.style.display = 'inline-block';
        userMenu.style.marginLeft = '5px';
        
        const menuToggle = document.createElement('i');
        menuToggle.className = 'fas fa-chevron-down';
        menuToggle.style.cursor = 'pointer';
        menuToggle.style.fontSize = '0.8rem';
        menuToggle.style.color = '#666';
        menuToggle.style.padding = '5px';
        
        const dropdownContent = document.createElement('div');
        dropdownContent.className = 'dropdown-content';
        dropdownContent.style.display = 'none';
        dropdownContent.style.position = 'absolute';
        dropdownContent.style.backgroundColor = '#fff';
        dropdownContent.style.minWidth = '160px';
        dropdownContent.style.boxShadow = '0px 8px 16px 0px rgba(0,0,0,0.2)';
        dropdownContent.style.zIndex = '1';
        dropdownContent.style.right = '0';
        dropdownContent.style.borderRadius = '8px';
        dropdownContent.style.overflow = 'hidden';
        
        // Add dropdown items
        dropdownContent.innerHTML = `
            <a href="dashboard.html" style="color: black; padding: 12px 16px; text-decoration: none; display: block; font-size: 0.9rem;">
                <i class="fas fa-user" style="margin-right: 8px;"></i> Profile
            </a>
            <a href="settings.html" style="color: black; padding: 12px 16px; text-decoration: none; display: block; font-size: 0.9rem;">
                <i class="fas fa-cog" style="margin-right: 8px;"></i> Settings
            </a>
            <a href="#" id="logoutBtn" style="color: black; padding: 12px 16px; text-decoration: none; display: block; font-size: 0.9rem;">
                <i class="fas fa-sign-out-alt" style="margin-right: 8px;"></i> Logout
            </a>
        `;
        
        // Toggle dropdown visibility
        menuToggle.addEventListener('click', () => {
            if (dropdownContent.style.display === 'none') {
                dropdownContent.style.display = 'block';
            } else {
                dropdownContent.style.display = 'none';
            }
        });
        
        // Close dropdown when clicking outside
        document.addEventListener('click', (event) => {
            if (!userMenu.contains(event.target)) {
                dropdownContent.style.display = 'none';
            }
        });
        
        userMenu.appendChild(menuToggle);
        userMenu.appendChild(dropdownContent);
        profilePhotoContainer.appendChild(userMenu);
        
        // Add elements to the navigation
        userProfileContainer.appendChild(notificationContainer);
        userProfileContainer.appendChild(profilePhotoContainer);
        
        // Replace existing content in nav-right
        navRight.innerHTML = '';
        navRight.appendChild(userProfileContainer);
        
        // Add logout functionality
        document.getElementById('logoutBtn').addEventListener('click', (e) => {
            e.preventDefault();
            localStorage.removeItem('user');
            window.location.href = 'login.html';
        });
    });
}

// Function to update any profile photo elements on the page
function updateProfilePhotos() {
    const user = getUserData();
    if (!user) return;
    
    // Update all profile photo elements
    const profilePhotos = document.querySelectorAll('img#profilePhoto');
    profilePhotos.forEach(photo => {
        if (user.profilePhoto) {
            photo.src = user.profilePhoto;
        } else if (user.profilePhotoUrl) {
            photo.src = user.profilePhotoUrl;
        } else {
            photo.src = 'profile-placeholder.jpg';
        }
    });
    
    // Update all userName elements
    const userNames = document.querySelectorAll('#userName');
    userNames.forEach(name => {
        name.textContent = user.firstName || 'User';
    });
}

// Initialize user profile when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const user = getUserData();
    
    // If user is logged in, update the navigation and profile photos
    if (user) {
        updateUserNavigation();
        updateProfilePhotos();
    } else {
        // If not logged in, check if we're not already on the login page
        const currentPage = window.location.pathname.split('/').pop();
        if (currentPage !== 'login.html' && currentPage !== 'signup.html') {
            window.location.href = 'login.html';
        }
    }
});