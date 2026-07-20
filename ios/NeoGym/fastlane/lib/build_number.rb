# frozen_string_literal: true

module NeoGym
  module BuildNumber
    MAXIMUM = 2_147_483_647
    DECIMAL = /\A[1-9][0-9]*\z/

    class Invalid < ArgumentError; end

    module_function

    def select(latest:, override: nil)
      latest_number = parse_latest(latest)
      return next_after(latest_number) if override.nil?

      selected = parse_positive(override)
      if selected <= latest_number
        raise Invalid, "build-number override is already used or is not newer than the TestFlight train"
      end

      selected
    end

    def assert_still_available!(selected:, latest:)
      selected_number = parse_positive(selected)
      latest_number = parse_latest(latest)
      return selected_number if latest_number < selected_number

      raise Invalid, "selected build number became unavailable; create a new archive"
    end

    def parse_positive(value)
      source = value.is_a?(Integer) ? value.to_s : value
      unless source.is_a?(String) && DECIMAL.match?(source)
        raise Invalid, "build number must be an unambiguous positive decimal integer"
      end

      parsed = Integer(source, 10)
      raise Invalid, "build number exceeds the supported range" if parsed > MAXIMUM

      parsed
    end

    def parse_latest(value)
      return 0 if value.nil?
      if value.is_a?(Integer)
        raise Invalid, "latest build number is invalid" if value.negative? || value > MAXIMUM

        return value
      end
      return 0 if value == "0"

      parse_positive(value)
    end

    def next_after(latest)
      raise Invalid, "TestFlight build-number range is exhausted" if latest >= MAXIMUM

      latest + 1
    end
  end
end
