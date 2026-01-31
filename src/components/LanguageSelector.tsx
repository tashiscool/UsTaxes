import { ReactElement, useState, MouseEvent } from 'react'
import {
  Button,
  Menu,
  MenuItem,
  ListItemText,
  makeStyles,
  createStyles,
  Theme,
  Typography,
  Tooltip
} from '@material-ui/core'
import {
  Language as LanguageIcon,
  ExpandMore as ExpandMoreIcon
} from '@material-ui/icons'
import { useTranslation } from 'react-i18next'
import {
  languages,
  LanguageCode,
  changeLanguage,
  getCurrentLanguage
} from 'ustaxes/i18n'

const useStyles = makeStyles((theme: Theme) =>
  createStyles({
    button: {
      textTransform: 'none',
      minWidth: 'auto',
      padding: theme.spacing(0.5, 1)
    },
    buttonCompact: {
      minWidth: 'auto',
      padding: theme.spacing(0.5)
    },
    icon: {
      marginRight: theme.spacing(0.5)
    },
    iconOnly: {
      marginRight: 0
    },
    menuItem: {
      minWidth: 150
    },
    menuItemSelected: {
      backgroundColor: theme.palette.action.selected
    },
    flag: {
      marginRight: theme.spacing(1),
      fontSize: '1.2rem'
    },
    languageName: {
      display: 'flex',
      flexDirection: 'column'
    },
    nativeName: {
      fontSize: '0.75rem',
      color: theme.palette.text.secondary
    }
  })
)

interface LanguageSelectorProps {
  variant?: 'text' | 'outlined' | 'contained'
  size?: 'small' | 'medium' | 'large'
  showLabel?: boolean
  compact?: boolean
}

export const LanguageSelector = ({
  variant = 'text',
  size = 'medium',
  showLabel = true,
  compact = false
}: LanguageSelectorProps): ReactElement => {
  const classes = useStyles()
  const { t, i18n } = useTranslation()
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null)

  const currentLang = getCurrentLanguage()

  const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
    setAnchorEl(event.currentTarget)
  }

  const handleClose = () => {
    setAnchorEl(null)
  }

  const handleLanguageSelect = async (langCode: LanguageCode) => {
    await changeLanguage(langCode)
    handleClose()
  }

  const getFlagEmoji = (countryCode: string): string => {
    // Convert country code to flag emoji
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }

  if (compact) {
    return (
      <>
        <Tooltip title={t('common.language')} arrow>
          <Button
            aria-label={t('common.language')}
            aria-haspopup="true"
            aria-expanded={Boolean(anchorEl)}
            onClick={handleClick}
            className={classes.buttonCompact}
            size={size}
          >
            <LanguageIcon className={classes.iconOnly} />
          </Button>
        </Tooltip>
        <Menu
          id="language-menu"
          anchorEl={anchorEl}
          keepMounted
          open={Boolean(anchorEl)}
          onClose={handleClose}
          getContentAnchorEl={null}
          anchorOrigin={{
            vertical: 'bottom',
            horizontal: 'right'
          }}
          transformOrigin={{
            vertical: 'top',
            horizontal: 'right'
          }}
        >
          {Object.entries(languages).map(([code, lang]) => (
            <MenuItem
              key={code}
              onClick={() => handleLanguageSelect(code as LanguageCode)}
              className={`${classes.menuItem} ${
                code === currentLang ? classes.menuItemSelected : ''
              }`}
              selected={code === currentLang}
            >
              <span className={classes.flag}>{getFlagEmoji(lang.flag)}</span>
              <ListItemText
                primary={lang.name}
                secondary={lang.nativeName !== lang.name ? lang.nativeName : undefined}
              />
            </MenuItem>
          ))}
        </Menu>
      </>
    )
  }

  return (
    <>
      <Button
        aria-label={t('common.language')}
        aria-haspopup="true"
        aria-expanded={Boolean(anchorEl)}
        onClick={handleClick}
        variant={variant}
        size={size}
        className={classes.button}
        startIcon={<LanguageIcon />}
        endIcon={<ExpandMoreIcon />}
      >
        {showLabel && (
          <Typography variant="body2">
            {languages[currentLang].nativeName}
          </Typography>
        )}
      </Button>
      <Menu
        id="language-menu"
        anchorEl={anchorEl}
        keepMounted
        open={Boolean(anchorEl)}
        onClose={handleClose}
        getContentAnchorEl={null}
        anchorOrigin={{
          vertical: 'bottom',
          horizontal: 'center'
        }}
        transformOrigin={{
          vertical: 'top',
          horizontal: 'center'
        }}
      >
        {Object.entries(languages).map(([code, lang]) => (
          <MenuItem
            key={code}
            onClick={() => handleLanguageSelect(code as LanguageCode)}
            className={`${classes.menuItem} ${
              code === currentLang ? classes.menuItemSelected : ''
            }`}
            selected={code === currentLang}
          >
            <span className={classes.flag}>{getFlagEmoji(lang.flag)}</span>
            <div className={classes.languageName}>
              <Typography variant="body1">{lang.name}</Typography>
              {lang.nativeName !== lang.name && (
                <Typography className={classes.nativeName}>
                  {lang.nativeName}
                </Typography>
              )}
            </div>
          </MenuItem>
        ))}
      </Menu>
    </>
  )
}

// Simple dropdown variant for settings page
interface LanguageDropdownProps {
  value?: LanguageCode
  onChange?: (lang: LanguageCode) => void
}

export const LanguageDropdown = ({
  onChange
}: LanguageDropdownProps): ReactElement => {
  const { t, i18n } = useTranslation()
  const currentLang = getCurrentLanguage()

  const handleChange = async (langCode: LanguageCode) => {
    await changeLanguage(langCode)
    if (onChange) {
      onChange(langCode)
    }
  }

  const getFlagEmoji = (countryCode: string): string => {
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map((char) => 127397 + char.charCodeAt(0))
    return String.fromCodePoint(...codePoints)
  }

  return (
    <div>
      <Typography variant="subtitle2" gutterBottom>
        {t('settings.language')}
      </Typography>
      {Object.entries(languages).map(([code, lang]) => (
        <Button
          key={code}
          onClick={() => handleChange(code as LanguageCode)}
          variant={code === currentLang ? 'contained' : 'outlined'}
          color={code === currentLang ? 'primary' : 'default'}
          style={{ marginRight: 8, marginBottom: 8 }}
        >
          <span style={{ marginRight: 8 }}>{getFlagEmoji(lang.flag)}</span>
          {lang.nativeName}
        </Button>
      ))}
    </div>
  )
}

export default LanguageSelector
